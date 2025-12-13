/* ============================================
   DASHBOARD - extra actions
   ============================================ */

function closeUpdatesModal() {
  const m = document.getElementById('updatesModal');
  if (m) m.style.display = 'none';
}

// Admin CSV export (optional)
function exportToCSV() {
  if (!window.isAdmin) {
    showToast('❌ Admin uniquement');
    return;
  }

  const users = globalData.users || {};
  const objectives = globalData.objectives || {};

  let csv = 'Utilisateur,Email,Objectif,Actuel,Cible,Pourcentage\n';

  for (const [uid, user] of Object.entries(users)) {
    const name = (user.nom || '').toString().replace(/"/g, '""');
    const email = (user.email || '').toString().replace(/"/g, '""');
    const uobjs = user.objectives || {};

    for (const [objId, objData] of Object.entries(uobjs)) {
      const cfg = objectives[objId];
      if (!cfg) continue;
      const objName = (cfg.name || objId).toString().replace(/"/g, '""');
      const cur = Number(objData?.current) || 0;
      const target = Number(cfg.target) || 0;
      const pct = calculatePercent(cur, target);
      csv += `"${name}","${email}","${objName}",${cur},${target},${pct}\n`;
    }
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard_export_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('✅ Export CSV prêt');
  logActivity('Export CSV');
}

console.log('✅ Module Dashboard chargé');
