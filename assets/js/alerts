// CONFIG (La même que app.js)
const firebaseConfig = {
  apiKey: "AIzaSyAGaitqmFwExvJ9ZUpkdUdCKAqqDOP2cdQ",
  authDomain: "objectif-restaurant.firebaseapp.com",
  databaseURL: "https://objectif-restaurant-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "objectif-restaurant",
  storageBucket: "objectif-restaurant.firebasestorage.app",
  messagingSenderId: "910113283000",
  appId: "1:910113283000:web:0951fd9dca01aa6e46cd4d"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// GESTION DU THEME (Copie de ton code existant)
if(localStorage.getItem('heiko_dark_mode') === null) localStorage.setItem('heiko_dark_mode', 'true');
if(localStorage.getItem('heiko_dark_mode') === 'true') document.body.classList.add('dark-mode');

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('heiko_dark_mode', document.body.classList.contains('dark-mode'));
}

// AUTH
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById("loginOverlay").style.display = "none";
    document.getElementById("appContent").style.display = "block";
    
    db.ref('users/' + user.uid).once('value', s => {
      const u = s.val() || {};
      document.getElementById('userName').textContent = u.name || "Membre";
    });

    loadAlerts();
  } else {
    document.getElementById("loginOverlay").style.display = "flex";
    document.getElementById("appContent").style.display = "none";
  }
});

// LOGIN LOGIC
document.getElementById("btnLogin").onclick = () => {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;
  auth.signInWithEmailAndPassword(email, pass).catch(() => {
    document.getElementById("loginPass").classList.add("error");
    setTimeout(() => document.getElementById("loginPass").classList.remove("error"), 1000);
    alert("❌ Erreur connexion");
  });
};

function clearLoginError() { document.getElementById("loginPass").classList.remove("error"); }
function togglePass() { const x = document.getElementById("loginPass"); x.type = (x.type === "password") ? "text" : "password"; }
function logout() { auth.signOut(); location.reload(); }

// MENU LOGIC
function toggleGlobalMenu(force) {
    const menu = document.getElementById("globalMenu");
    const backdrop = document.getElementById("globalMenuBackdrop");
    if(!menu || !backdrop) return;
    const isOpen = menu.classList.contains("open");
    const shouldOpen = (typeof force === "boolean") ? force : !isOpen;
    if(shouldOpen) {
        menu.classList.add("open");
        backdrop.classList.add("open");
        document.body.style.overflow = "hidden";
    } else {
        menu.classList.remove("open");
        backdrop.classList.remove("open");
        document.body.style.overflow = "";
    }
}

// --- ALERTS LOGIC ---

function loadAlerts() {
  const container = document.getElementById('alertsContainer');
  
  // Écoute en temps réel sur le nœud 'alerts'
  // limitToLast(50) pour ne pas charger trop d'historique
  db.ref('alerts').orderByChild('date').limitToLast(50).on('value', snap => {
    const data = snap.val();
    container.innerHTML = "";
    
    if (!data) {
      container.innerHTML = `<div class="alert-empty">Aucune alerte enregistrée pour le moment.</div>`;
      return;
    }

    // Convertir en tableau et trier (Le plus récent en haut)
    const alerts = Object.keys(data).map(k => ({ id: k, ...data[k] })).sort((a,b) => b.date - a.date);

    alerts.forEach(alert => {
      const dateObj = new Date(alert.date);
      const dateStr = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      
      // Nettoyage basique du HTML pour l'aperçu (enlève les balises style, script, etc)
      const cleanBody = (alert.body || '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').substring(0, 200) + '...';

      const div = document.createElement('div');
      div.className = 'alert-card';
      div.innerHTML = `
        <div class="alert-header">
          <span class="alert-source-badge">${alert.source || 'Système'}</span>
          <span class="alert-date">${dateStr}</span>
        </div>
        <div class="alert-title">${alert.title}</div>
        <div class="alert-body-snippet">${cleanBody}</div>
      `;
      container.appendChild(div);
    });
  });
}
