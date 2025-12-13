/* ============================================
   DASHBOARD FUNCTIONS - Heiko Dashboard
   ============================================ */

// Ouvrir le modal des updates
function openUpdatesModal() {
  document.getElementById('updatesModal').style.display = 'flex';
  logActivity('Ouverture updates');
}

// Fermer le modal des updates
function closeUpdatesModal() {
  document.getElementById('updatesModal').style.display = 'none';
}

// Exporter les données en CSV (pour admin)
function exportToCSV() {
  if (!isAdmin) return;
  
  let csv = 'Utilisateur,Email,Objectif,Actuel,Cible,Pourcentage\n';
  
  Object.entries(globalData.users
