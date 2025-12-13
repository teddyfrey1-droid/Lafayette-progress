/* ============================================
   CONFIG / INIT - Heiko Dashboard

   Firebase configuration is loaded from localStorage (key: heiko_firebase_config)
   so you can safely redeploy without hardcoding secrets.

   How it works:
   - If the config exists in localStorage, we init Firebase immediately.
   - If missing, a setup overlay appears (admin pastes JSON from Firebase console),
     then we save it and reload.

   You can reset it by running in console:
     localStorage.removeItem('heiko_firebase_config'); location.reload();
   ============================================ */

// Globals used across modules
window.currentUser = null;
window.isAdmin = false;
window.globalData = window.globalData || {
  users: {},
  objectives: {},
  planning: {},
  publicUpdates: {}
};

window.db = null;
window.auth = null;

// Optional: used by motivation + money tank (default 100€)
window.MONEY_TANK_MAX_EUR = window.MONEY_TANK_MAX_EUR || 100;

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function getStoredFirebaseConfig() {
  const raw = localStorage.getItem('heiko_firebase_config');
  if (!raw) return null;
  const cfg = safeJsonParse(raw);
  if (!cfg || typeof cfg !== 'object') return null;
  // Basic validation
  const must = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
  for (const k of must) {
    if (!cfg[k]) return null;
  }
  return cfg;
}

function showFirebaseSetupOverlay(reason) {
  const overlay = document.getElementById('firebaseSetupOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  const hint = document.getElementById('firebaseSetupHint');
  if (hint) hint.textContent = reason || '';
}

function hideFirebaseSetupOverlay() {
  const overlay = document.getElementById('firebaseSetupOverlay');
  if (overlay) overlay.style.display = 'none';
}

function initFirebase() {
  const cfg = getStoredFirebaseConfig();
  if (!cfg) {
    showFirebaseSetupOverlay(
      "Configuration Firebase manquante. Colle ici l'objet JSON 'firebaseConfig' depuis la console Firebase (Paramètres du projet)."
    );
    return false;
  }

  try {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(cfg);
    }
    window.auth = firebase.auth();
    window.db = firebase.database();
    hideFirebaseSetupOverlay();
    return true;
  } catch (e) {
    console.error('Firebase init error', e);
    showFirebaseSetupOverlay("Erreur d'initialisation Firebase. Vérifie la config (JSON) et réessaie.");
    return false;
  }
}

// Save config from modal
function saveFirebaseConfigFromUi() {
  const ta = document.getElementById('firebaseConfigTextarea');
  const err = document.getElementById('firebaseSetupError');
  if (!ta) return;
  const cfg = safeJsonParse(ta.value.trim());
  if (!cfg) {
    if (err) err.textContent = 'JSON invalide. Colle l’objet complet.';
    return;
  }
  localStorage.setItem('heiko_firebase_config', JSON.stringify(cfg));
  if (err) err.textContent = '';
  location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize firebase as early as possible.
  initFirebase();
});

console.log('✅ Module Config chargé');
