/* ============================================
   AUTHENTICATION - Heiko Dashboard
   - Firebase Auth (email/password)
   - Role check via Realtime DB: users/{uid}/role
   ============================================ */

function ensureFirebaseReady() {
  if (!window.auth || !window.db || typeof firebase === 'undefined') {
    showToast('⚠️ Firebase non initialisé. Ouvre le menu ⚙️ et colle la config Firebase.');
    return false;
  }
  return true;
}

// Login with email/password
async function login() {
  if (!ensureFirebaseReady()) return;

  const emailEl = document.getElementById('loginEmail');
  const passEl = document.getElementById('loginPassword');
  const email = (emailEl?.value || '').trim();
  const password = (passEl?.value || '').trim();

  if (!email || !password) {
    showToast('❌ Email et mot de passe requis');
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (e) {
    console.error(e);
    const msg = (e && e.message) ? e.message : 'Erreur de connexion';
    showToast('❌ ' + msg);
    // Shake login box (optional)
    const box = document.querySelector('.login-box');
    if (box) {
      box.classList.remove('shake');
      // force reflow
      void box.offsetWidth;
      box.classList.add('shake');
    }
  }
}

async function logout() {
  if (!ensureFirebaseReady()) return;
  try {
    await auth.signOut();
    showToast('👋 Déconnecté');
  } catch (e) {
    console.error(e);
    showToast('❌ Erreur déconnexion');
  }
}

// Resolve role/admin and show app
async function onUserSignedIn(user) {
  window.currentUser = user;
  console.log('✅ Utilisateur connecté:', user.email);

  // Default role
  window.isAdmin = false;

  try {
    const snap = await db.ref('users/' + user.uid + '/role').once('value');
    window.isAdmin = (snap.val() === 'admin' || snap.val() === 'superadmin');
  } catch (e) {
    console.warn('Role check failed:', e);
  }

  // UI switches
  const loginOverlay = document.getElementById('loginOverlay');
  const appContent = document.getElementById('appContent');
  if (loginOverlay) loginOverlay.style.display = 'none';
  if (appContent) appContent.style.display = 'block';

  // Add an item in menu for logout
  const logoutBtn = document.getElementById('menuLogout');
  if (logoutBtn) {
    logoutBtn.style.display = 'flex';
    logoutBtn.onclick = (e) => { e.preventDefault(); logout(); };
  }

  // Load data subscriptions
  loadAllData();
}

function onUserSignedOut() {
  window.currentUser = null;
  window.isAdmin = false;

  const loginOverlay = document.getElementById('loginOverlay');
  const appContent = document.getElementById('appContent');
  if (loginOverlay) loginOverlay.style.display = 'flex';
  if (appContent) appContent.style.display = 'none';

  // Clear UI
  const primary = document.getElementById('primaryObjectives');
  const secondary = document.getElementById('secondaryObjectives');
  if (primary) primary.innerHTML = '';
  if (secondary) secondary.innerHTML = '';
}

// Init auth listener when Firebase becomes ready
document.addEventListener('DOMContentLoaded', () => {
  // If config missing, the setup overlay will block; user will reload after saving.
  if (!window.auth || !window.db) return;

  auth.onAuthStateChanged((user) => {
    if (user) onUserSignedIn(user);
    else onUserSignedOut();
  });
});

console.log('✅ Module Auth chargé');
