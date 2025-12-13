/* ============================================
   AUTHENTICATION - Heiko Dashboard
   - Uses Firebase Auth (compat)
   - Shows login overlay, then app content
   ============================================ */

(function () {
  const loginOverlay = document.getElementById('loginOverlay');
  const appContent = document.getElementById('appContent');
  const emailEl = document.getElementById('loginEmail');
  const passEl = document.getElementById('loginPassword');

  // Defensive: if Firebase isn't loaded, fail loudly
  if (typeof firebase === 'undefined' || !window.auth || !window.db) {
    console.error('Firebase not initialized. Check js/config.js and firebase scripts in index.html');
  }

  // Login function exposed to inline onclick
  window.login = async function login() {
    const email = (emailEl?.value || '').trim();
    const password = passEl?.value || '';

    if (!email || !password) {
      showToast?.('⚠️ Renseigne email + mot de passe');
      return;
    }

    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      console.error(err);
      const msg = err?.message || 'Connexion impossible';
      showToast?.('❌ ' + msg);
    }
  };

  window.logout = async function logout() {
    try {
      await auth.signOut();
      showToast?.('✅ Déconnecté');
    } catch (err) {
      console.error(err);
      showToast?.('❌ Erreur déconnexion');
    }
  };

  // Enter key support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && loginOverlay && loginOverlay.style.display !== 'none') {
      window.login();
    }
  });

  // Auth state listener
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // Logged out
      window.currentUser = null;
      window.isAdmin = false;

      if (loginOverlay) loginOverlay.style.display = 'flex';
      if (appContent) appContent.style.display = 'none';

      // Hide admin menu item
      const adminMenuItem = document.getElementById('adminMenuItem');
      if (adminMenuItem) adminMenuItem.style.display = 'none';
      return;
    }

    // Logged in
    window.currentUser = user;

    try {
      const snap = await db.ref('users/' + user.uid + '/role').once('value');
      window.isAdmin = (snap.val() === 'admin' || snap.val() === 'superadmin');
    } catch (e) {
      window.isAdmin = false;
    }

    if (loginOverlay) loginOverlay.style.display = 'none';
    if (appContent) appContent.style.display = 'block';

    // Admin menu
    const adminMenuItem = document.getElementById('adminMenuItem');
    if (adminMenuItem) {
      adminMenuItem.style.display = window.isAdmin ? 'block' : 'none';
      adminMenuItem.onclick = () => {
        // Open admin panel if exists
        const panel = document.getElementById('adminPanel');
        if (panel) {
          panel.style.display = 'block';
          showToast?.('🛠️ Mode admin');
        } else {
          showToast?.('⚠️ Panel admin non disponible');
        }
      };
    }

    // Start data
    if (typeof loadAllData === 'function') {
      loadAllData();
    } else {
      console.warn('loadAllData is not defined (js/data.js)');
    }
  });
})();

console.log('✅ Module Auth chargé');
