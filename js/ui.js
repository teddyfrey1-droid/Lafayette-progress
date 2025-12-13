/* ============================================
   UI UPDATES - Heiko Dashboard
   ============================================ */

function updateDashboard() {
  if (!currentUser) return;

  const userData = (globalData.users || {})[currentUser.uid] || {};

  // Welcome
  const welcomeEl = document.querySelector('.user-welcome');
  if (welcomeEl) {
    const name = escapeHtml(userData.nom || userData.name || 'Utilisateur');
    welcomeEl.innerHTML = `Bonjour <strong>${name}</strong>`;
  }

  updateGlobalScore();
  renderObjectives();
  updateLastUpdate();
}

function updateGlobalScore() {
  const scoreEl = document.querySelector('.global-score-value');
  if (!scoreEl) return;

  const userData = (globalData.users || {})[currentUser.uid] || {};
  const userObj = userData.objectives || {};
  const objs = globalData.objectives || {};

  let total = 0;
  let n = 0;

  Object.keys(userObj).forEach((objId) => {
    const cfg = objs[objId];
    const ud = userObj[objId] || {};
    if (!cfg) return;

    const target = Number(cfg.target ?? cfg.cible ?? 0);
    const current = Number(ud.current ?? ud.actuel ?? 0);
    if (!target) return;

    const pct = calculatePercent(current, target);
    total += pct;
    n += 1;
  });

  const globalPct = n ? (total / n) : 0;
  scoreEl.textContent = `${Math.round(globalPct)}%`;

  // Trigger money tank / motivation observers by updating text node
}

function renderObjectives() {
  const primaryWrap = document.getElementById('primaryObjectives');
  const secondaryWrap = document.getElementById('secondaryObjectives');
  if (!primaryWrap || !secondaryWrap) return;

  primaryWrap.innerHTML = '';
  secondaryWrap.innerHTML = '';

  const userData = (globalData.users || {})[currentUser.uid] || {};
  const userObj = userData.objectives || {};
  const objs = globalData.objectives || {};

  const entries = Object.keys(objs).map((id) => ({ id, cfg: objs[id] }));
  entries.sort((a, b) => (a.cfg.order ?? 0) - (b.cfg.order ?? 0));

  for (const { id, cfg } of entries) {
    const ud = userObj[id] || {};
    const title = escapeHtml(cfg.title || cfg.nom || cfg.name || 'Objectif');
    const target = Number(cfg.target ?? cfg.cible ?? 0);
    const current = Number(ud.current ?? ud.actuel ?? 0);
    const unit = escapeHtml(cfg.unit || cfg.unite || '');

    const pct = target ? calculatePercent(current, target) : 0;
    const isPrimary = (cfg.category === 'primary') || (cfg.isPrimary === true) || (cfg.type === 'primary') || (cfg.principal === true);

    const card = document.createElement('div');
    card.className = 'objective-card';
    card.innerHTML = `
      <div class="objective-header">
        <div class="objective-title">${title}</div>
        <div class="objective-percent">${Math.round(pct)}%</div>
      </div>
      <div class="objective-metrics">
        <div class="metric"><span class="metric-label">Actuel</span><span class="metric-value">${formatNumber(current)}${unit}</span></div>
        <div class="metric"><span class="metric-label">Cible</span><span class="metric-value">${formatNumber(target)}${unit}</span></div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${Math.min(100, Math.max(0, pct))}%;"></div>
      </div>
    `;

    (isPrimary ? primaryWrap : secondaryWrap).appendChild(card);
  }
}

function updateLastUpdate() {
  const el = document.querySelector('.last-update');
  if (!el) return;
  const dt = new Date();
  const two = (n) => String(n).padStart(2, '0');
  el.textContent = `Dernière mise à jour : ${two(dt.getDate())}/${two(dt.getMonth()+1)}/${dt.getFullYear()} à ${two(dt.getHours())}:${two(dt.getMinutes())}`;
}

console.log('✅ Module UI chargé');
