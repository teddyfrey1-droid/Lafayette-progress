/* ============================================
   DATA MANAGEMENT - Heiko Dashboard
   ============================================ */

// Charger toutes les données depuis Firebase
function loadAllData() {
  console.log("🔄 Chargement des données...");
  
  // Charger les utilisateurs
  db.ref('users').on('value', function(snapshot) {
    globalData.users = snapshot.val() || {};
    console.log("✅ Utilisateurs chargés:", Object.keys(globalData.users).length);
    updateDashboard();
  });
  
  // Charger les objectifs
  db.ref('objectives').on('value', function(snapshot) {
    globalData.objectives = snapshot.val() || {};
    console.log("✅ Objectifs chargés:", Object.keys(globalData.objectives).length);
    updateDashboard();
  });
  
  // Charger le planning
  db.ref('planning').on('value', function(snapshot) {
    globalData.planning = snapshot.val() || {};
    console.log("✅ Planning chargé");
    renderCalendar();
  });
  
  // Charger les updates publiques
  db.ref('publicUpdates').on('value', function(snapshot) {
    globalData.publicUpdates = snapshot.val() || {};
    console.log("✅ Updates chargées");
    renderPublicUpdates();
    showTopAlert();
  });
  
  // Logger l'activité utilisateur
  logActivity('Connexion');
}

// Sauvegarder un objectif
function saveObjective(objId, data) {
  return db.ref('objectives/' + objId).set(data)
    .then(function() {
      showToast("✅ Objectif sauvegardé");
      console.log("Objectif sauvegardé:", objId);
    })
    .catch(function(error) {
      showToast("❌ Erreur sauvegarde");
      console.
