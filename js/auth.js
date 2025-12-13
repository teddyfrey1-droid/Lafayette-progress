/* ============================================
   AUTHENTICATION - Heiko Dashboard
   ============================================ */

// État d'authentification
firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    currentUser = user;
    console.log("Utilisateur connecté:", user.email);
    
    // Vérifier si admin
    db.ref('users/' + user.uid + '/role').once('value').then(function(snap) {
      isAdmin = (snap.val() === 'admin');
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('appContent').style.display = 'block';
      
      // Charger les données
      loadAllData();
      
      // Afficher les contrôles admin si
