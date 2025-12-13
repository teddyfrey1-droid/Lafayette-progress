/* ============================================
   UTILITIES - Heiko Dashboard
   ============================================ */

// Afficher un toast
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.innerHTML = message;
  toast.className = 'show';
  
  setTimeout(function() {
    toast.className = toast.className.replace('show', '');
  }, 3000);
}

// Formater un nombre en euros
function formatEuros(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Formater une date
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Calculer un pourcentage
function calculatePercent(current, target) {
  if (!target || target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

// Dark mode toggle
function toggleDarkMode() {
  // Smooth theme switch (avoid flashes)
  document.body.classList.add('theme-transition');
  window.clearTimeout(window.__themeTransitionTimer);
  window.__themeTransitionTimer = window.setTimeout(() => {
    document.body.classList.remove('theme-transition');
  }, 350);

  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  
  // Sauvegarder la préférence
  localStorage.setItem('darkMode', isDark ? 'true' : 'false');
  
  // Changer l'icône
  const icon = document.querySelector('.toggle-icon');
  icon.textContent = isDark ? '🌙' : '☀️';
  
  logActivity('Thème changé', isDark ? 'dark' : 'light');
}

// Charger la préférence de thème
function loadThemePreference() {
  const isDark = localStorage.getItem('darkMode') === 'true';
  if (isDark) {
    document.body.classList.add('dark-mode');
    const icon = document.querySelector('.toggle-icon');
    if (icon) icon.textContent = '🌙';
  }
}

// Appliquer le thème au chargement
document.addEventListener('DOMContentLoaded', function() {
  loadThemePreference();
});

// Générer un ID unique
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Escape HTML pour éviter XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Debounce pour limiter les appels
function debounce(func, wait) {
  let timeout;
  return function executedFunction() {
    const context = this;
    const args = arguments;
    
    clearTimeout(timeout);
    timeout = setTimeout(function() {
      func.apply(context, args);
    }, wait);
  };
}

// Vérifier si mobile
function isMobile() {
  return window.innerWidth <= 768;
}

// Animer un nombre
function animateNumber(element, start, end, duration) {
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;
  
  const timer = setInterval(function() {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      element.textContent = Math.round(end);
      clearInterval(timer);
    } else {
      element.textContent = Math.round(current);
    }
  }, 16);
}

// Copier dans le presse-papier
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(function() {
    showToast("✅ Copié !");
  }).catch(function() {
    showToast("❌ Erreur de copie");
  });
}

// Vérifier si une date est aujourd'hui
function isToday(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

// Obtenir le début du mois
function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Obtenir la fin du mois
function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

console.log("✅ Module Utils chargé");
