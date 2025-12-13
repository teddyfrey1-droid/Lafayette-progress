/* ============================================
   ADMIN PANEL - Heiko Dashboard
   ============================================ */

// Ouvrir le panneau admin
function openAdminPanel() {
  if (!isAdmin) {
    showToast("❌ Accès refusé");
    return;
  }
  
  document.getElementById('adminPanel').classList.add('active');
  loadAdminData();
  logActivity('Ouverture panel admin');
}

// Fermer le panneau admin
function closeAdminPanel() {
  document.getElementById('adminPanel').classList.remove('active');
}

// Charger les données admin
function loadAdminData() {
  renderUsersList();
  renderObjectivesList();
  calculateBudget();
}

// Afficher la liste des utilisateurs
function renderUsersList() {
  const container = document.getElementById('usersList');
  if (!container) return;
  
  let html = '';
  let totalGain = 0;
  
  Object.entries(globalData.users).forEach(function([userId, user]) {
    if (!user.objectives) return;
    
    let userGain = 0;
    Object.keys(user.objectives).forEach(function(objId) {
      const objData = user.objectives[objId];
      const objConfig = globalData.objectives[objId];
      
      if (objConfig && objData.current >= objConfig.target) {
        userGain += objConfig.bonus || 0;
      }
    });
    
    totalGain += userGain;
    
    const statusClass = user.status === 'active' ? 'active' : 'pending';
    
    html += `
      <div class="user-item">
        <div class="user-info">
          <span class="user-name">
            <span class="status-dot ${statusClass}"></span>
            ${escapeHtml(user.nom)}
            ${user.role === 'admin' ? '<span class="admin-tag">ADMIN</span>' : ''}
          </span>
          <span class="user-meta">${escapeHtml(user.email)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="user-gain">${formatEuros(userGain)}</span>
          <button class="action-btn" onclick="editUser('${userId}')" title="Modifier">✏️</button>
        </div>
      </div>
    `;
  });
  
  html += `<div class="total-row"><span>TOTAL GAINS</span><span>${formatEuros(totalGain)}</span></div>`;
  
  container.innerHTML = html;
}

// Afficher la liste des objectifs
function renderObjectivesList() {
  const container = document.getElementById('objectivesList');
  if (!container) return;
  
  let html = '';
  
  Object.entries(globalData.objectives).forEach(function([objId, obj]) {
    html += `
      <div class="user-item">
        <div class="user-info">
          <span class="user-name">${obj.icon} ${escapeHtml(obj.name)}</span>
          <span class="user-meta">Cible: ${formatEuros(obj.target)} • Bonus: ${formatEuros(obj.bonus)}</span>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="action-btn" onclick="editObjective('${objId}')" title="Modifier">✏️</button>
          <button class="action-btn delete" onclick="deleteObjective('${objId}')" title="Supprimer">🗑️</button>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Calculer le budget
function calculateBudget() {
  const budgetInput = document.getElementById('globalBudgetInput');
  if (!budgetInput) return;
  
  const budget = parseFloat(budgetInput.value) || 0;
  
  let totalCost = 0;
  Object.values(globalData.objectives).forEach(function(obj) {
    totalCost += obj.bonus || 0;
  });
  
  const remaining = budget - totalCost;
  const percent = budget > 0 ? (totalCost / budget) * 100 : 0;
  
  // Afficher dans l'UI
  const remainingEl = document.getElementById('budgetRemaining');
  const usedEl = document.getElementById('budgetUsed');
  const barEl = document.getElementById('budgetBarFill');
  
  if (remainingEl) remainingEl.textContent = formatEuros(remaining);
  if (usedEl) usedEl.textContent = formatEuros(totalCost);
  if (barEl) {
    barEl.style.width = Math.min(percent, 100) + '%';
    barEl.className = percent > 100 ? 'budget-bar-fill danger' : 'budget-bar-fill';
  }
}

// Éditer un utilisateur
function editUser(userId) {
  // Cette fonction ouvrirait un panneau d'édition
  // Version simplifiée pour l'exemple
  showToast("🛠️ Fonction d'édition à implémenter");
  console.log("Édition utilisateur:", userId);
}

// Éditer un objectif
function editObjective(objId) {
  showToast("🛠️ Fonction d'édition à implémenter");
  console.log("Édition objectif:", objId);
}

// Supprimer un objectif
function deleteObjective(objId) {
  if (!confirm("Supprimer cet objectif ?")) return;
  
  db.ref('objectives/' + objId).remove()
    .then(function() {
      showToast("✅ Objectif supprimé");
    })
    .catch(function(error) {
      showToast("❌ Erreur");
      console.error(error);
    });
}

// Basculer entre les onglets admin
function switchAdminTab(tabName) {
  // Cacher tous les onglets
  document.querySelectorAll('.admin-tab-content').forEach(function(tab) {
    tab.style.display = 'none';
  });
  
  // Désactiver tous les boutons
  document.querySelectorAll('.btn-tab').forEach(function(btn) {
    btn.classList.remove('active');
  });
  
  // Afficher l'onglet sélectionné
  const selectedTab = document.getElementById(tabName + 'Tab');
  if (selectedTab) selectedTab.style.display = 'block';
  
  // Activer le bouton
  event.target.classList.add('active');
}

console.log("✅ Module Admin chargé");
