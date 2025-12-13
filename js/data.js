/* ============================================
   DATA - Heiko Dashboard (Firebase Realtime DB)
   Schema (expected):
     objectives/{objId} = { name, icon, target, bonus, category? }
     users/{uid} = { nom, email, role, status, objectives: {objId:{current}} }
     planning/... (optional)
     publicUpdates/... (optional)
   ============================================ */

let _subscriptions = [];

function _sub(ref, cb) {
  ref.on('value', cb);
  _subscriptions.push(() => ref.off('value', cb));
}

function clearSubscriptions() {
  _subscriptions.forEach(fn => {
    try { fn(); } catch {}
  });
  _subscriptions = [];
}

function loadAllData() {
  if (!window.currentUser || !window.db) return;

  // Reset subscriptions on re-login
  clearSubscriptions();

  console.log('🔄 Chargement des données...');

  _sub(db.ref('users'), (snapshot) => {
    globalData.users = snapshot.val() || {};
    updateDashboard();
  });

  _sub(db.ref('objectives'), (snapshot) => {
    globalData.objectives = snapshot.val() || {};
    updateDashboard();
  });

  _sub(db.ref('planning'), (snapshot) => {
    globalData.planning = snapshot.val() || {};
    if (typeof renderCalendar === 'function') renderCalendar();
  });

  _sub(db.ref('publicUpdates'), (snapshot) => {
    globalData.publicUpdates = snapshot.val() || {};
    if (typeof renderPublicUpdates === 'function') renderPublicUpdates();
    if (typeof showTopAlert === 'function') showTopAlert();
  });

  // Log activity
  if (typeof logActivity === 'function') logActivity('Connexion');
}

// Basic feedback box -> stores to /feedback/{id}
function sendFeedback() {
  if (!window.currentUser || !window.db) {
    showToast('⚠️ Connexion requise');
    return;
  }
  const ta = document.getElementById('fbContent');
  const content = (ta?.value || '').trim();
  if (!content) {
    showToast('❌ Écris un message');
    return;
  }
  const id = (typeof generateId === 'function') ? generateId() : ('fb_' + Date.now());
  const payload = {
    uid: currentUser.uid,
    email: currentUser.email || '',
    content,
    createdAt: new Date().toISOString()
  };
  db.ref('feedback/' + id).set(payload)
    .then(() => {
      showToast('✅ Merci !');
      if (ta) ta.value = '';
      const modal = document.getElementById('feedbackModal');
      if (modal) modal.style.display = 'none';
    })
    .catch((e) => {
      console.error(e);
      showToast('❌ Erreur envoi');
    });
}

// Activity log (optional) -> /activity/{uid}/{id}
function logActivity(action, meta) {
  if (!window.currentUser || !window.db) return;
  const id = (typeof generateId === 'function') ? generateId() : ('act_' + Date.now());
  const payload = {
    action: action || 'action',
    meta: meta || null,
    ts: new Date().toISOString()
  };
  db.ref('activity/' + currentUser.uid + '/' + id).set(payload).catch(() => {});
}

console.log('✅ Module Data chargé');
