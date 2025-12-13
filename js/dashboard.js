/* ============================================
   DASHBOARD FUNCTIONS - Heiko Dashboard
   ============================================ */

function openUpdatesModal() {
  const m = document.getElementById('updatesModal');
  if (m) m.style.display = 'flex';
  logActivity?.('Ouverture updates');
}

function closeUpdatesModal() {
  const m = document.getElementById('updatesModal');
  if (m) m.style.display = 'none';
}

function renderPublicUpdates() {
  const list = document.getElementById('publicUpdatesList');
  if (!list) return;
  const updates = globalData.publicUpdates || {};
  const items = Object.entries(updates)
    .sort((a,b) => (b[1]?.ts||0) - (a[1]?.ts||0))
    .slice(0, 20);

  if (!items.length) {
    list.innerHTML = '<div style="text-align:center; color:#999;">Aucune nouveauté</div>';
    return;
  }

  list.innerHTML = '';
  for (const [id, u] of items) {
    const row = document.createElement('div');
    row.className = 'update-row';
    const date = u.ts ? new Date(u.ts) : null;
    const when = date ? `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}` : '';
    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:10px;">
        <div style="font-weight:700;">${escapeHtml(u.title || 'Update')}</div>
        <div style="color:var(--text-muted); font-size:12px;">${when}</div>
      </div>
      <div style="margin-top:6px; color:var(--text-muted); font-size:13px;">${escapeHtml(u.text || '')}</div>
    `;
    list.appendChild(row);
  }
}

function showTopAlert() {
  const top = document.getElementById('topAlert');
  const txt = document.getElementById('topAlertText');
  if (!top || !txt) return;

  const updates = globalData.publicUpdates || {};
  const latest = Object.values(updates).sort((a,b) => (b?.ts||0) - (a?.ts||0))[0];
  if (!latest) {
    top.style.display = 'none';
    return;
  }
  txt.textContent = latest.title ? `${latest.title} — ${latest.text || ''}` : (latest.text || '');
  top.style.display = 'flex';
}

// Menu (hamburger)
(function initMenu() {
  const btn = document.getElementById('menuBtn');
  const dd = document.getElementById('menuDropdown');
  const adminItem = document.getElementById('adminMenuItem');
  if (!btn || !dd) return;

  const close = () => {
    dd.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    dd.style.display = 'flex';
    dd.style.flexDirection = 'column';
    btn.setAttribute('aria-expanded', 'true');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dd.style.display === 'none' || !dd.style.display) open(); else close();
  });

  document.addEventListener('click', () => close());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // Admin hook (toggle from auth.js)
  if (adminItem) {
    adminItem.addEventListener('click', () => {
      close();
      if (typeof openAdminPanel === 'function') openAdminPanel();
      else showToast?.('⚠️ Admin indisponible');
    });
  }
})();

console.log('✅ Module Dashboard chargé');
