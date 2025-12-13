/* ============================================
   DATA MANAGEMENT - Heiko Dashboard
   - Real-time listeners
   - Safe writes for feedback & activity logs
   ============================================ */

function loadAllData() {
  console.log('🔄 Chargement des données...');

  // Users
  db.ref('users').on('value', (snapshot) => {
    globalData.users = snapshot.val() || {};
    updateDashboard();
  });

  // Objectives config
  db.ref('objectives').on('value', (snapshot) => {
    globalData.objectives = snapshot.val() || {};
    updateDashboard();
  });

  // Planning/calendar
  db.ref('planning').on('value', (snapshot) => {
    globalData.planning = snapshot.val() || {};
    if (typeof renderCalendar === 'function') renderCalendar();
  });

  // Public updates
  db.ref('publicUpdates').on('value', (snapshot) => {
    globalData.publicUpdates = snapshot.val() || {};
    if (typeof renderPublicUpdates === 'function') renderPublicUpdates();
    if (typeof showTopAlert === 'function') showTopAlert();
  });

  // First activity log
  logActivity('Connexion');
}

function logActivity(action, extra = {}) {
  try {
    if (!currentUser) return;
    const payload = {
      uid: currentUser.uid,
      email: currentUser.email || null,
      action: action || 'Action',
      ts: Date.now(),
      ...extra
    };
    db.ref(`activityLogs/${currentUser.uid}`).push(payload).catch(() => {});
  } catch (e) {
    // silent
  }
}

function sendFeedback() {
  const input = document.getElementById('fbContent');
  const content = (input?.value || '').trim();
  if (!content) {
    showToast?.('⚠️ Écris un message');
    return;
  }

  const payload = {
    uid: currentUser?.uid || null,
    email: currentUser?.email || null,
    content,
    ts: Date.now()
  };

  db.ref('feedback').push(payload)
    .then(() => {
      input.value = '';
      document.getElementById('feedbackModal').style.display = 'none';
      showToast?.('✅ Merci !');
      logActivity('Feedback envoyé');
    })
    .catch((err) => {
      console.error(err);
      showToast?.('❌ Erreur');
    });
}

console.log('✅ Module Data chargé');
