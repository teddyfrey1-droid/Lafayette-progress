/**
 * Cloud Functions - Smart Broadcast (Email + Push)
 * Gère l'envoi intelligent : Email, Push, ou les deux.
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineSecret, defineString, defineInt } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// --- CONFIGURATION SMTP ---
const SMTP_HOST = defineString('SMTP_HOST', { default: '' });
const SMTP_SERVICE = defineString('SMTP_SERVICE', { default: '' });
const SMTP_PORT = defineInt('SMTP_PORT', { default: 587 });

const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

const MAIL_FROM_EMAIL = defineString('MAIL_FROM_EMAIL', { default: '' });
const MAIL_FROM_NAME_DEFAULT = defineString('MAIL_FROM_NAME_DEFAULT', { default: 'Lafayette' });

// --- UTILS ---
function buildTransporter() {
  const service = SMTP_SERVICE.value();
  const host = SMTP_HOST.value();
  const port = Number(SMTP_PORT.value());
  const auth = { user: SMTP_USER.value(), pass: SMTP_PASS.value() };

  if (service) return nodemailer.createTransport({ service, auth });
  if (!host) throw new HttpsError('failed-precondition', 'Missing SMTP config.');
  return nodemailer.createTransport({ host, port, secure: port === 465, auth });
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>?/gm, '').trim();
}

function escapeHtml(str){
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Normalise le payload d'alerte.
 * - Format "Lafayette" attendu: {subject|title, bodyHtml|html|body, timestamp}
 * - Format Brevo Inbound Parse: { items: [ { Subject, RawHtmlBody, RawTextBody, ExtractedMarkdownMessage, SentAtDate, From, To, ... } ] }
 *
 * Retourne: { subject, bodyHtml, ts, meta }
 */
function normalizeAlertPayload(rawBody){
  let body = rawBody;

  // Certains proxies envoient un body string JSON.
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = { bodyHtml: `<pre>${escapeHtml(body)}</pre>` }; }
  }

  body = body && typeof body === 'object' ? body : {};

  // Brevo Inbound Parse
  if (Array.isArray(body.items) && body.items[0] && typeof body.items[0] === 'object') {
    const item = body.items[0];
    const fallbackText = item.RawTextBody || item.ExtractedMarkdownMessage || '';
    const html = item.RawHtmlBody || (fallbackText ? `<pre>${escapeHtml(fallbackText)}</pre>` : '');
    const sentAt = Date.parse(item.SentAtDate || '') || Date.now();
    return {
      subject: String(item.Subject || 'Alerte'),
      bodyHtml: String(html || ''),
      ts: Number(sentAt),
      meta: {
        provider: 'brevo_inbound',
        from: item.From || null,
        to: item.To || null,
      }
    };
  }

  // Format historique / webhook custom
  const subject = String(body.subject || body.title || 'Alerte Technique');
  const bodyHtml = String(body.bodyHtml || body.html || body.body || '');
  const ts = Number(body.timestamp || Date.now());
  return { subject, bodyHtml, ts, meta: { provider: 'custom' } };
}

function parseHHMM(value){
  const s = String(value || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return NaN;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if(!Number.isFinite(h) || !Number.isFinite(mm)) return NaN;
  if(h < 0 || h > 23 || mm < 0 || mm > 59) return NaN;
  return (h * 60) + mm;
}

function getParisTimeInfo(ts){
  const d = new Date(Number(ts) || Date.now());
  // weekday (Mon..Sun) and hh/mm in Europe/Paris
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(d);
  const byType = {};
  parts.forEach(p => { if(p && p.type) byType[p.type] = p.value; });
  const wd = String(byType.weekday || '').slice(0,3);
  const map = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6, Sun:7 };
  const dow = map[wd] || 0;
  const h = Number(byType.hour);
  const m = Number(byType.minute);
  const minutes = (Number.isFinite(h) && Number.isFinite(m)) ? (h*60+m) : NaN;
  return { dow, minutes };
}

function isTeamActiveAt(team, nowMinutes, nowDow){
  if(!team) return false;
  if(team.enabled === false) return false;
  const start = parseHHMM(team.start || team.startTime || team.from);
  const end = parseHHMM(team.end || team.endTime || team.to);
  if(!Number.isFinite(start) || !Number.isFinite(end)) return false;

  // start == end => considéré comme 24h/24
  const crossesMidnight = start > end;
  let dayToCheck = nowDow;
  if(crossesMidnight && Number.isFinite(nowMinutes)){
    // Pour la tranche "après minuit", rattacher à la veille.
    if(nowMinutes < end){
      dayToCheck = (nowDow === 1) ? 7 : (nowDow - 1);
    }
  }

  const days = Array.isArray(team.days) ? team.days.map(n=>Number(n)).filter(n=>n>=1 && n<=7) : [];
  if(days.length > 0 && !days.includes(dayToCheck)) return false;

  if(start === end) return true;
  if(!crossesMidnight){
    return nowMinutes >= start && nowMinutes < end;
  }
  return (nowMinutes >= start) || (nowMinutes < end);
}

function chunk(arr, size){
  const out = [];
  for(let i=0; i<arr.length; i+=size){ out.push(arr.slice(i, i+size)); }
  return out;
}

async function assertIsAdmin(uid) {
  const snap = await admin.database().ref(`users/${uid}/role`).once('value');
  const role = (snap.val() || '').toLowerCase();
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
}

// --- FONCTION PRINCIPALE ---
exports.sendSmartBroadcast = onCall(
  {
    region: 'us-central1',
    secrets: [SMTP_USER, SMTP_PASS],
    timeoutSeconds: 300,
    memory: '256MiB',
    cors: true, 
  },
  async (request) => {
    // 1. Sécurité
    if (!request.auth) throw new HttpsError('unauthenticated', 'Connexion requise.');
    await assertIsAdmin(request.auth.uid);

    // 2. Récupération des données
    const data = request.data || {};
    const { recipientIds, subject, html, fromName, channels } = data;
    
    const useEmail = channels?.email || false;
    const usePush = channels?.push || false;

    if (!recipientIds || recipientIds.length === 0) return { successCount: 0 };

    // 3. Récupération des infos utilisateurs
    const snap = await admin.database().ref('users').once('value');
    const allUsers = snap.val() || {};

    let emailTargets = new Set(); 
    let pushTokens = [];

    // 4. Logique Intelligente
    recipientIds.forEach(uid => {
      const user = allUsers[uid];
      if (!user) return;

      const userEmail = user.email;
      const userPushToken = user.fcmToken || user.pushToken || (user.fcm ? user.fcm.token : null);
      const pushAllowed = (user.pushEnabled !== false);
      const isPushable = pushAllowed && !!userPushToken;
      const isEmailable = (userEmail && userEmail.includes('@'));

      let willReceivePush = false;

      // Logique PUSH
      if (usePush && isPushable) {
        pushTokens.push(userPushToken);
        willReceivePush = true;
      }

      // Logique EMAIL (Si demandé OU si fallback car pas de push)
      if (isEmailable) {
        if (useEmail || (usePush && !willReceivePush)) {
          emailTargets.add(userEmail);
        }
      }
    });

    let successCount = 0;
    const errors = [];

    // 5. Envoi PUSH
    if (pushTokens.length > 0) {
      try {
        const message = {
          tokens: pushTokens,
          // CORRECTION: Utilisation de 'data' uniquement pour éviter les doublons système
          data: {
            title: subject || 'Nouvelle annonce',
            body: stripHtml(html).substring(0, 140),
            url: '/index.html#dashboard'
          }
        };
        const batchResponse = await admin.messaging().sendEachForMulticast(message);
        successCount += batchResponse.successCount;
      } catch (err) {
        logger.error('Erreur Push', err);
      }
    }

    // 6. Envoi EMAILS
    if (emailTargets.size > 0) {
      try {
        const transporter = buildTransporter();
        const senderEmail = MAIL_FROM_EMAIL.value() || SMTP_USER.value();
        const senderName = fromName || MAIL_FROM_NAME_DEFAULT.value();
        
        const emailPromises = Array.from(emailTargets).map(toAddr => {
          return transporter.sendMail({
            from: `"${senderName}" <${senderEmail}>`,
            to: toAddr,
            subject: subject,
            html: html,
            text: stripHtml(html)
          }).then(() => 1).catch(() => 0);
        });

        const results = await Promise.all(emailPromises);
        successCount += results.reduce((acc, val) => acc + val, 0);

      } catch (err) {
        logger.error('Erreur Email', err);
      }
    }

    // 7. Log
    await admin.database().ref('mailLogs').push({
      date: Date.now(),
      authorUid: request.auth.uid,
      subject: subject,
      stats: { emails: emailTargets.size, pushes: pushTokens.length, success: successCount }
    });

    return { successCount, details: { emails: emailTargets.size, pushes: pushTokens.length } };
  }
);

// --- WEBHOOK ALERTE EATPILOT (Routage par équipes + canaux) ---
exports.receiveExternalAlert = onRequest(
  {
    region: 'us-central1',
    secrets: [SMTP_USER, SMTP_PASS],
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req, res) => {
    // 1) Sécurité simple (ne pas casser l'intégration existante)
    const provided = String(req.query.secret || req.get('x-secret') || '');
    if (provided !== 'SUPER_SECRET_LAFAYETTE_99') return res.status(403).send('Forbidden');

    // 1.1) Supporte 2 formats:
    //  - Payload "custom" historique: {subject|title, bodyHtml|html|body, timestamp}
    //  - Payload Brevo inbound parsing: { items: [ { Subject, RawHtmlBody, RawTextBody, SentAtDate, ... } ] }
    const normalized = normalizeAlertPayload(req.body);
    const subject = normalized.subject;
    const bodyHtml = normalized.bodyHtml;
    const ts = normalized.ts;

    try {
      // 2) Chargement settings + users + équipes
      const [usersSnap, teamsSnap, routingSnap] = await Promise.all([
        admin.database().ref('users').once('value'),
        admin.database().ref('alertTeams').once('value'),
        admin.database().ref('settings/alertRouting').once('value'),
      ]);

      const users = usersSnap.val() || {};
      const teams = teamsSnap.val() || {};
      const routing = routingSnap.val() || {};

      const mode = String(routing.mode || 'push_fallback');
      const fallbackNoTeam = String(routing.fallbackNoTeam || 'all');

      // 3) Détermination équipes actives (heure FR) + destinataires
      const { dow, minutes } = getParisTimeInfo(ts);
      const activeTeamIds = [];
      const activeTeamNames = [];
      const recipientUids = new Set();

      Object.keys(teams).forEach(teamId => {
        const t = teams[teamId] || {};
        if(isTeamActiveAt(t, minutes, dow)){
          activeTeamIds.push(teamId);
          activeTeamNames.push(String(t.name || teamId));
          const uids = Array.isArray(t.userIds) ? t.userIds
            : (Array.isArray(t.members) ? t.members
            : (t.memberUids && typeof t.memberUids === 'object' ? Object.keys(t.memberUids)
            : []));
          uids.forEach(uid => { if(uid) recipientUids.add(String(uid)); });
        }
      });

      if(recipientUids.size === 0){
        if(fallbackNoTeam === 'admins'){
          Object.keys(users).forEach(uid => {
            const u = users[uid] || {};
            const r = String(u.role || '').toLowerCase();
            if(r === 'admin' || r === 'superadmin') recipientUids.add(uid);
          });
        } else if(fallbackNoTeam === 'none'){
          // aucun destinataire
        } else {
          // all (par défaut) : ne pas rater une alerte
          Object.keys(users).forEach(uid => recipientUids.add(uid));
        }
      }

      // 4) Build targets (push/email) selon le mode
      const emailTargets = new Set();
      const pushTokens = new Set();

      recipientUids.forEach(uid => {
        const u = users[uid] || {};
        const email = (u.email && String(u.email).includes('@')) ? String(u.email).trim() : '';
        const token = u.fcmToken || u.pushToken || (u.fcm ? u.fcm.token : null);
        const pushAllowed = (u.pushEnabled !== false);

        if(mode === 'email_only'){
          if(email) emailTargets.add(email);
          return;
        }
        if(mode === 'push_only'){
          if(pushAllowed && token) pushTokens.add(String(token));
          return;
        }
        if(mode === 'both'){
          if(email) emailTargets.add(email);
          if(pushAllowed && token) pushTokens.add(String(token));
          return;
        }

        // push_fallback (par défaut)
        if(pushAllowed && token) pushTokens.add(String(token));
        else if(email) emailTargets.add(email);
      });

      // 5) Envoi
      let pushSuccess = 0;
      let emailSuccess = 0;

      // Push (FCM)
      const tokensArr = Array.from(pushTokens);
      if(tokensArr.length > 0){
        const chunks = chunk(tokensArr, 500);
        for(const c of chunks){
          const resp = await admin.messaging().sendEachForMulticast({
            tokens: c,
            // CORRECTION: Utilisation de 'data' uniquement pour éviter les doublons système
            data: {
              title: '⚠️ ' + subject,
              body: 'Nouvelle alerte reçue. Voir le détail.',
              url: '/diffusion.html#alerts'
            }
          });
          pushSuccess += (resp.successCount || 0);
        }
      }

      // Email (BCC)
      const emailsArr = Array.from(emailTargets);
      if(emailsArr.length > 0){
        const transporter = buildTransporter();
        const fromEmail = MAIL_FROM_EMAIL.value() || SMTP_USER.value();
        const fromName = MAIL_FROM_NAME_DEFAULT.value() || 'Lafayette';
        const from = `${fromName} <${fromEmail}>`;

        const html = bodyHtml || `<p>${stripHtml(bodyHtml || '')}</p>`;
        const bccChunks = chunk(emailsArr, 50);
        for(const bcc of bccChunks){
          await transporter.sendMail({
            from,
            to: from,
            bcc,
            subject: '⚠️ ' + subject,
            html,
            text: stripHtml(html),
          });
          emailSuccess += bcc.length;
        }
      }

      // 6) Sauvegarde en base (historique)
      await admin.database().ref('alerts').push({
        title: subject,
        body: bodyHtml,
        date: ts,
        source: 'EatPilot',
        routing: {
          mode,
          fallbackNoTeam,
          teams: activeTeamIds,
          teamNames: activeTeamNames,
          recipients: {
            push: pushTokens.size,
            email: emailTargets.size,
          }
        }
      });

      res.status(200).send('OK');
    } catch (e) {
      logger.error(e);
      res.status(500).send('Error');
    }
  }
);
