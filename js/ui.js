/* ============================================
   UI - Heiko Dashboard
   - Renders objectives
   - Computes global score
   - Updates header (last update)
   ============================================ */

function updateDashboard() {
  if (!window.currentUser) return;
  const userData = globalData.users?.[currentUser.uid];
  if (!userData) return;

  // Welcome
  const welcomeEl = document.querySelector('.user-welcome');
  if (welcomeEl) {
    const name = escapeHtml(String(userData.nom || 'Utilisateur'));
    welcomeEl.innerHTML = `Bonjour <strong>${name}</strong>`;
  }

  updateGlobalScore();
  renderObjectives();
  updateLastUpdate();

  // Admin visibility
  const adminBtn = document.getElementById('menuAdmin');
  if (adminBtn) adminBtn.style.display = window.isAdmin ? 'flex' : 'none';
}

function updateLastUpdate() {
  const el = document.querySelector('.last-update');
  if (!el) return;
  const now = new Date();
  const txt = now.toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  el.textContent = `Dernière mise à jour : ${txt}`;
}

function getUserObjectives() {
  const userData = globalData.users?.[currentUser.uid];
  return userData?.objectives || {};
}

function updateGlobalScore() {
  const valueEl = document.querySelector('.global-score-value');
  if (!valueEl) return;

  const userObjectives = getUserObjectives();
  const configs = globalData.objectives || {};

  let total = 0;
  let count = 0;

  for (const [objId, objData] of Object.entries(userObjectives)) {
    const cfg = configs[objId];
    if (!cfg) continue;
    const cur = Number(objData?.current);
    const target = Number(cfg.target);
    if (!Number.isFinite(cur) || !Number.isFinite(target) || target <= 0) continue;
    total += calculatePercent(cur, target);
    count++;
  }

  const global = count ? Math.round(total / count) : 0;
  valueEl.textContent = `${global}%`;
}

function renderObjectives() {
  const primaryEl = document.getElementById('primaryObjectives');
  const secondaryEl = document.getElementById('secondaryObjectives');
  if (!primaryEl || !secondaryEl) return;

  const userObjectives = getUserObjectives();
  const configs = globalData.objectives || {};

  const primary = [];
  const secondary = [];

  for (const [objId, cfg] of Object.entries(configs)) {
    const userObj = userObjectives[objId] || { current: 0 };
    const category = (cfg.category || cfg.type || '').toString().toLowerCase();
    const isSecondary = category.includes('second');
    (isSecondary ? secondary : primary).push({ id: objId, cfg, userObj });
  }

  const cardHtml = ({ id, cfg, userObj }) => {
    const cur = Number(userObj?.current) || 0;
    const target = Number(cfg.target) || 0;
    const pct = calculatePercent(cur, target);
    const bonus = Number(cfg.bonus) || 0;
    const ok = target > 0 && cur >= target;

    const icon = escapeHtml(String(cfg.icon || '🎯'));
    const name = escapeHtml(String(cfg.name || 'Objectif'));

    return `
      <div class="objective-card ${ok ? 'done' : ''}" data-obj="${escapeHtml(id)}">
        <div class="objective-top">
          <div class="objective-title">
            <span class="objective-icon">${icon}</span>
            <span class="objective-name">${name}</span>
          </div>
          <div class="objective-meta">
            <span class="objective-pct">${pct}%</span>
          </div>
        </div>
        <div class="objective-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%;"></div>
          </div>
        </div>
        <div class="objective-bottom">
          <div class="objective-stats">
            <span>${formatEuros(cur)} / ${formatEuros(target)}</span>
            <span class="objective-bonus">+ ${formatEuros(bonus)}</span>
          </div>
        </div>
      </div>
    `;
  };

  primaryEl.innerHTML = primary.map(cardHtml).join('') || `<div style="color:var(--text-muted); text-align:center; padding:12px;">Aucun objectif</div>`;
  secondaryEl.innerHTML = secondary.map(cardHtml).join('') || `<div style="color:var(--text-muted); text-align:center; padding:12px;">Aucun objectif</div>`;
}

// Public updates list (modal)
function renderPublicUpdates() {
  const list = document.getElementById('publicUpdatesList');
  if (!list) return;
  const updates = globalData.publicUpdates || {};
  const entries = Object.entries(updates)
    .sort((a, b) => (b[1]?.createdAt || '').localeCompare(a[1]?.createdAt || ''))
    .slice(0, 20);

  if (!entries.length) {
    list.innerHTML = `<div style="text-align:center; color:#999;">Aucune nouveauté</div>`;
    return;
  }

  list.innerHTML = entries.map(([id, u]) => {
    const title = escapeHtml(String(u.title || 'Mise à jour'));
    const desc = escapeHtml(String(u.desc || u.text || ''));
    const date = escapeHtml(String(u.createdAt ? formatDate(u.createdAt) : ''));
    return `
      <div class="update-item">
        <div class="update-title">${title}</div>
        <div class="update-desc">${desc}</div>
        <div class="update-date">${date}</div>
      </div>
    `;
  }).join('');
}

function showTopAlert() {
  const box = document.getElementById('topAlert');
  const txt = document.getElementById('topAlertText');
  if (!box || !txt) return;
  const updates = globalData.publicUpdates || {};
  const latest = Object.values(updates)
    .sort((a, b) => (b?.createdAt || '').localeCompare(a?.createdAt || ''))[0];
  if (!latest) {
    box.style.display = 'none';
    return;
  }
  txt.textContent = latest.title || latest.desc || latest.text || 'Mise à jour';
  box.style.display = 'flex';
}

function openUpdatesModal() {
  const m = document.getElementById('updatesModal');
  if (m) m.style.display = 'flex';
  logActivity('Ouverture updates');
}

console.log('✅ Module UI chargé');
