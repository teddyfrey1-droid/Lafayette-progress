/* ============================================
   UI UPDATES - Heiko Dashboard
   ============================================ */

// Mettre à jour tout le dashboard
function updateDashboard() {
  if (!currentUser) return;
  
  const userData = globalData.users[currentUser.uid];
  if (!userData) return;
  
  // Mettre à jour le nom d'utilisateur
  const welcomeEl = document.querySelector('.user-welcome');
  if (welcomeEl) {
    welcomeEl.innerHTML = `Bonjour <strong>${escapeHtml(userData.nom || 'Utilisateur')}</strong>`;
  }
  
  // Calculer et afficher le score global
  updateGlobalScore();
  
  // Afficher les objectifs
  renderObjectives();
  
  // Mettre à jour la dernière visite
  updateLastUpdate();
}

// Calculer et afficher le score global
function updateGlobalScore() {
  if (!currentUser) return;
  
  const userData = globalData.users[currentUser.uid];
  if (!userData || !userData.objectives) return;
  
  let totalScore = 0;
  let objectiveCount = 0;
  
  Object.keys(userData.objectives).forEach(function(objId) {
    const objData = userData.objectives[objId];
    const objConfig = globalData.objectives[objId];
    
    if (objConfig && objData.current !== undefined && objConfig.target) {
      const percent = calculatePercent(objData.current, objConfig.target);
      totalScore += percent;
      objectiveCount++;
    }
  });
  
  const globalScore = objectiveCount > 0 ? Math
