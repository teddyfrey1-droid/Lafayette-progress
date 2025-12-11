/* ============================================
   CALENDAR - Heiko Dashboard
   ============================================ */

let currentCalendarDate = new Date();

// Rendre le calendrier
function renderCalendar() {
  const container = document.getElementById('calendarGrid');
  if (!container) return;
  
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  
  // Mettre à jour le titre
  const titleEl = document.querySelector('.cal-month-title');
  if (titleEl) {
    titleEl.textContent = new Date(year, month).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric'
    });
  }
  
  // Calculer le calendrier
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = firstDay === 0 ? 6 : firstDay - 1; // Lundi = 0
  
  let html = '';
  
  // Noms des jours
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  dayNames.forEach(function(day) {
    html += `<div class="cal-day-name">${day}</div>`;
  });
  
  // Cellules vides avant le 1er
  for (let i = 0; i < startDay; i++) {
    html += '<div class="cal-cell"></div>';
  }
  
  // Jours du mois
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = getEventsForDate(dateStr);
    
    html += `
      <div class="cal-cell">
        <span class="cal-date">${day}</span>
        ${events.map(e => `<span class="cal-event-dot evt-${e.type}">${e.label}</span>`).join('')}
      </div>
    `;
  }
  
  container.innerHTML = html;
}

// Obtenir les événements pour une date
function getEventsForDate(dateStr) {
  const events = [];
  const planning = globalData.planning || {};
  
  Object.entries(planning).forEach(function([key, event]) {
    if (event.date === dateStr) {
      events.push({
        type: event.type || 'heiko',
        label: event.label || ''
      });
    }
  });
  
  return events;
}

// Naviguer dans le calendrier
function navigateCalendar(direction) {
  if (direction === 'prev') {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
  } else {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
  }
  
  renderCalendar();
  logActivity('Navigation calendrier', direction);
}

// Ajouter un événement au planning (admin)
function addPlanningEvent(date, type, label) {
  if (!isAdmin) return;
  
  const event = {
    date: date,
    type: type,
    label: label,
    createdAt: new Date().toISOString()
  };
  
  return db.ref('planning').push(event)
    .then(function() {
      showToast("✅ Événement ajouté");
    });
}

console.log("✅ Module Calendar chargé");
