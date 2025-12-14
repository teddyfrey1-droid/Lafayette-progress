// CONFIG
    const firebaseConfig = {
      apiKey: "AIzaSyAGaitqmFwExvJ9ZUpkdUdCKAqqDOP2cdQ",
      authDomain: "objectif-restaurant.firebaseapp.com",
      databaseURL: "https://objectif-restaurant-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "objectif-restaurant",
      storageBucket: "objectif-restaurant.firebasestorage.app",
      messagingSenderId: "910113283000",
      appId: "1:910113283000:web:0951fd9dca01aa6e46cd4d"
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();

    let currentUser = null;
    let allUsers = {};
    let allObjs = {};
    let allLogs = {};
    let allFeedbacks = {};
    let allUpdates = {};
    let globalSettings = { budget: 0 };
    const BASE_HOURS = 35;
    const SUPER_ADMIN_EMAIL = "teddy.frey1@gmail.com";

    // CALENDAR DATA
    const calEvents = [
        { t: "HEIKO x STURIA", start: "2025-12-01", end: "2026-01-31", c: "evt-heiko" },
        { t: "Flyers Sturia", start: "2025-12-01", end: "2025-12-31", c: "evt-sturia" },
        { t: "7off7 Deliveroo", start: "2025-12-01", end: "2025-12-07", c: "evt-deliv" },
        { t: "BOGOF Deliveroo", start: "2025-12-08", end: "2025-12-14", c: "evt-deliv" },
        { t: "BOGOF UberEats", start: "2025-12-15", end: "2025-12-21", c: "evt-uber" },
        { t: "Street Marketing", start: "2026-01-01", end: "2026-01-31", c: "evt-street" }
    ];
    let currentCalDate = new Date(2025, 11, 1);

    // INITIALIZE THEME - TOUJOURS EN MODE NUIT PAR DÉFAUT
    if(localStorage.getItem('heiko_dark_mode') === null) {
        localStorage.setItem('heiko_dark_mode', 'true');
    }
    if(localStorage.getItem('heiko_dark_mode') === 'true') {
        document.body.classList.add('dark-mode');
    }
    window.addEventListener('DOMContentLoaded', function() {
        const icon = document.querySelector('.toggle-icon');
        if(icon) icon.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
    });

    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('heiko_dark_mode', isDark);
        const icon = document.querySelector('.toggle-icon');
        if(icon) icon.textContent = isDark ? '☀️' : '🌙';
    }

    // --- PWA: service worker + bouton d'installation (si disponible) ---
    (function initPWA(){
      // Service worker
      if('serviceWorker' in navigator){
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('sw.js').catch(() => {});
        });
      }

      // Install prompt (Chrome/Edge/Android)
      let deferredPrompt = null;
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btn = document.getElementById('installAppBtn');
        if(btn){
          btn.style.display = 'block';
          btn.onclick = async () => {
            try{
              btn.disabled = true;
              deferredPrompt.prompt();
              await deferredPrompt.userChoice;
            } catch(_){
              // ignore
            }
            deferredPrompt = null;
            btn.style.display = 'none';
            btn.disabled = false;
          };
        }
      });
      window.addEventListener('appinstalled', () => {
        const btn = document.getElementById('installAppBtn');
        if(btn) btn.style.display = 'none';
        deferredPrompt = null;
      });
    })();

    
    // GLOBAL MENU (all users)
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
    document.addEventListener("keydown", (e) => {
        if(e.key === "Escape") toggleGlobalMenu(false);
    });

// AUTH
    auth.onAuthStateChanged(user => {
      if (user) {
        document.getElementById("loginOverlay").style.display = "none";
        document.getElementById("appContent").style.display = "block";
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'resetPassword') { /* Handled */ }

        db.ref('users/' + user.uid).on('value', snap => {
          const val = snap.val();
          if(!val) {
             const def = { name: "Utilisateur", hours:35, role:'staff', email: user.email, status: 'pending' };
             db.ref('users/'+user.uid).set(def);
             currentUser = def;
          } else { 
             currentUser = val; 
             if(currentUser.status !== 'active') {
                 db.ref('users/'+user.uid).update({ status: 'active', lastLogin: Date.now() });
             }
          }
          currentUser.uid = user.uid; currentUser.email = user.email;
          const newLogRef = db.ref("logs").push();
          newLogRef.set({ user: currentUser.name, action: "Connexion", type: "session", startTime: Date.now(), lastSeen: Date.now() });
          setInterval(() => { newLogRef.update({ lastSeen: Date.now() }); }, 60000);
          updateUI();
        });
        loadData();
        renderNativeCalendar();
      } else {
        document.getElementById("loginOverlay").style.display = "flex";
        document.getElementById("appContent").style.display = "none";
      }
    });

    document.getElementById("btnLogin").onclick = () => {
      const email = document.getElementById("loginEmail").value.trim();
      const pass = document.getElementById("loginPass").value;
      auth.signInWithEmailAndPassword(email, pass).catch(e => {
          // LOGIN ERROR FEEDBACK
          document.getElementById("loginPass").classList.add("error");
          document.getElementById("loginEmail").classList.add("error");
          setTimeout(() => {
             document.getElementById("loginPass").classList.remove("error");
             document.getElementById("loginEmail").classList.remove("error");
          }, 1000); // Remove animation but keep red border logic if preferred, here just animate
          alert("❌ Mot de passe incorrect !");
      });
    };

    function clearLoginError() {
        document.getElementById("loginPass").classList.remove("error");
        document.getElementById("loginEmail").classList.remove("error");
    }

    function togglePass() {
        const x = document.getElementById("loginPass");
        x.type = (x.type === "password") ? "text" : "password";
    }

    function logout() { auth.signOut(); location.reload(); }
    window.resetPassword = () => {
      let email = document.getElementById("loginEmail").value.trim();
      if (!email) email = prompt("Email pour réinitialisation :");
      if(email) auth.sendPasswordResetEmail(email).then(() => alert("Email envoyé !")).catch(e => alert(e.message));
    };

    function logAction(action, detail) {
        db.ref("logs").push({ user: currentUser ? currentUser.name : "Inconnu", action: action, detail: detail || "", type: "action", time: Date.now() });
    }
    function showToast(message) {
        const toast = document.getElementById("toast"); toast.textContent = message; toast.className = "show";
        setTimeout(() => { toast.className = "hide"; }, 3000);
    }

    function loadData() {
      db.ref('objectives').on('value', s => { 
          allObjs = s.val() || {}; 
          try {
             renderDashboard(); 
             if(currentUser && (currentUser.role === 'admin' || currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())) {
                 renderAdminObjs(); renderSimulator();
             }
          } catch(e) { console.error(e); }
      });
      db.ref('users').on('value', s => { allUsers = s.val() || {}; if(currentUser && (currentUser.role==='admin' || currentUser.email === SUPER_ADMIN_EMAIL)) { renderAdminUsers(); renderSimulator(); } });
      db.ref('settings').on('value', s => { globalSettings = s.val() || { budget: 0 }; if(currentUser && (currentUser.role==='admin' || currentUser.email === SUPER_ADMIN_EMAIL)) { renderSimulator(); } });
      db.ref('logs').limitToLast(2000).on('value', s => { allLogs = s.val() || {}; if(currentUser && currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) renderLogs(allLogs); });
      db.ref('feedbacks').on('value', s => { allFeedbacks = s.val() || {}; if(currentUser && currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) renderFeedbacks(allFeedbacks); });
      
      // LOAD UPDATES & CHECK ALERT
      db.ref('updates').on('value', s => { 
          allUpdates = s.val() || {}; 
          renderUpdatesPublic();
          checkNewUpdates(allUpdates);
          if(currentUser && currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) renderUpdatesAdmin();
      });
    }

    // CHECK FOR NEW UPDATES TO SHOW ALERT
    function checkNewUpdates(updates) {
        const arr = Object.values(updates).sort((a,b) => b.date - a.date);
        if(arr.length === 0) return;
        const latest = arr[0];
        const latestId = latest.title + "_" + latest.date;
        const lastSeen = localStorage.getItem('heiko_last_update_seen');
        
        if(latestId !== lastSeen) {
            // Trigger Alert
            const alertBox = document.getElementById("topAlert");
            document.getElementById("topAlertText").textContent = latest.title;
            alertBox.classList.remove("trigger");
            void alertBox.offsetWidth; // Force reflow
            alertBox.classList.add("trigger");
            
            // Save as seen
            localStorage.setItem('heiko_last_update_seen', latestId);
        }
    }

    function updateUI() {
      if(!currentUser) return;
      document.getElementById("userName").textContent = currentUser.name;
      document.getElementById("userHours").textContent = (currentUser.hours || 35) + "h";
      
      const isSuperUser = (currentUser.email && currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
      const isAdmin = (currentUser.role === 'admin' || isSuperUser);

      document.getElementById("btnAdmin").style.display = isAdmin ? 'block' : 'none';
      
      // SHOW TAB BUTTONS ONLY FOR SUPER ADMIN
      document.getElementById("btnTabLogs").style.display = isSuperUser ? 'block' : 'none';
      document.getElementById("btnTabFeedbacks").style.display = isSuperUser ? 'block' : 'none';

      const globalBudgetInput = document.getElementById("simGlobalBudget");
      const saveBudgetBtn = document.getElementById("btnSaveGlobalBudget");
      
      if(isSuperUser) {
          globalBudgetInput.disabled = false;
          saveBudgetBtn.style.display = 'inline-block';
      } else {
          globalBudgetInput.disabled = true;
          saveBudgetBtn.style.display = 'none';
      }
      
      if(isAdmin) {
          renderAdminObjs();
          renderSimulator();
      }

      renderDashboard();
    }

    // --- UPDATES LOGIC (CREATE, EDIT, DELETE) ---
    function saveUpdate() {
        const id = document.getElementById("uptId").value; // Empty if creation, filled if edit
        const t = document.getElementById("uptTitle").value.trim();
        const d = document.getElementById("uptDesc").value.trim();
        const type = document.getElementById("uptType").value;

        if(!t || !d) return alert("Remplir titre et description");

        if(id) {
            // MODE MODIFICATION
            db.ref('updates/' + id).update({ title:t, desc:d, type:type }).then(() => {
                showToast("✅ Mise à jour modifiée !");
                cancelUpdateEdit();
            });
        } else {
            // MODE CREATION
            db.ref('updates').push({ title:t, desc:d, type:type, date:Date.now() }).then(() => {
                showToast("📢 Publié !");
                cancelUpdateEdit();
            });
        }
    }

    function editUpdate(id) {
        const u = allUpdates[id];
        if(!u) return;
        document.getElementById("uptId").value = id;
        document.getElementById("uptTitle").value = u.title;
        document.getElementById("uptDesc").value = u.desc;
        document.getElementById("uptType").value = u.type;
        
        document.getElementById("btnSaveUpdate").textContent = "💾 Enregistrer Modification";
        document.getElementById("btnSaveUpdate").style.background = "#f59e0b"; // Orange for edit
        document.getElementById("btnCancelUpdate").style.display = "inline-block";
        document.querySelector('.admin-section').scrollIntoView({ behavior: 'smooth' });
    }

    function cancelUpdateEdit() {
        document.getElementById("uptId").value = "";
        document.getElementById("uptTitle").value = "";
        document.getElementById("uptDesc").value = "";
        
        document.getElementById("btnSaveUpdate").textContent = "Publier l'info";
        document.getElementById("btnSaveUpdate").style.background = "var(--primary)";
        document.getElementById("btnCancelUpdate").style.display = "none";
    }

    function deleteUpdate(id) {
        if(confirm("Supprimer cette info ?")) {
            db.ref('updates/'+id).remove();
            if(document.getElementById("uptId").value === id) cancelUpdateEdit();
        }
    }

    function renderUpdatesPublic() {
        const c = document.getElementById("publicUpdatesList"); c.innerHTML = "";
        const arr = Object.values(allUpdates).sort((a,b) => b.date - a.date);
        if(arr.length === 0) { c.innerHTML = "<div style='text-align:center;color:#999;font-style:italic;'>Aucune nouveauté pour le moment.</div>"; return; }
        
        arr.forEach(u => {
            const d = new Date(u.date).toLocaleDateString();
            let tag = "";
            if(u.type==='new') tag = `<span class="update-tag tag-new">✨ Nouveauté</span>`;
            if(u.type==='impr') tag = `<span class="update-tag tag-impr">🛠️ Amélioration</span>`;
            if(u.type==='fix') tag = `<span class="update-tag tag-fix">🐛 Correction</span>`;
            
            const div = document.createElement("div"); div.className = "update-card";
            div.innerHTML = `
                <div class="update-header">
                    ${tag}
                    <span class="update-date">${d}</span>
                </div>
                <span class="update-title">${u.title}</span>
                <div class="update-body">${u.desc}</div>
            `;
            c.appendChild(div);
        });
    }

    function renderUpdatesAdmin() {
        const c = document.getElementById("adminUpdatesList"); c.innerHTML = "";
        const arr = [];
        Object.keys(allUpdates).forEach(k => arr.push({id:k, ...allUpdates[k]}));
        arr.sort((a,b) => b.date - a.date);

        if(arr.length === 0) { c.innerHTML = "<div style='color:#ccc; font-style:italic;'>Aucune publication.</div>"; return; }
        
        arr.forEach(u => {
            const d = new Date(u.date).toLocaleDateString();
            const div = document.createElement("div"); div.className = "update-card";
            div.innerHTML = `
                <div class="update-header">
                    <span style="font-weight:800;font-size:12px;">${u.type.toUpperCase()} - ${d}</span>
                    <div style="display:flex; gap:10px;">
                        <button onclick="editUpdate('${u.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;">✏️</button>
                        <button onclick="deleteUpdate('${u.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;">🗑️</button>
                    </div>
                </div>
                <div style="font-weight:bold;">${u.title}</div>
                <div style="font-size:12px; color:var(--text-muted);">${u.desc.substring(0,50)}...</div>
            `;
            c.appendChild(div);
        });
    }

    // --- FEEDBACK LOGIC ---
    function sendFeedback() {
        const txt = document.getElementById("fbContent").value.trim();
        if(!txt) return;
        db.ref('feedbacks').push({ user: currentUser.name, msg: txt, time: Date.now() }).then(() => {
            showToast("Message envoyé ! Merci 💡");
            document.getElementById("fbContent").value = "";
            document.getElementById("feedbackModal").style.display = 'none';
        });
    }

    function renderFeedbacks(feeds) {
        const container = document.getElementById("feedbacksContainer"); container.innerHTML = "";
        const arr = Object.values(feeds).sort((a,b) => b.time - a.time);
        if(arr.length === 0) container.innerHTML = "<div style='color:#999;font-style:italic;'>Aucun avis.</div>";
        arr.forEach(f => {
            const d = new Date(f.time);
            const div = document.createElement("div"); div.className = "log-user-group";
            div.innerHTML = `<div class="group-header" style="cursor:default;"><div class="group-info">💬 ${f.user}</div><div class="last-seen">${d.toLocaleString()}</div></div><div style="padding:15px; font-size:13px; line-height:1.4; color:var(--text-main);">${f.msg}</div>`;
            container.appendChild(div);
        });
    }

    // --- COCKPIT SIMULATOR LOGIC ---
    let simObjs = {}; 

    function renderSimulator() { buildSimulatorUI(); }
    function buildSimulatorUI() {
        const container = document.getElementById("simObjList");
        container.innerHTML = "";
        simObjs = JSON.parse(JSON.stringify(allObjs)); 
        document.getElementById("simGlobalBudget").value = globalSettings.budget || 0;
        let totalPotential35h = 0;
        Object.keys(simObjs).forEach(k => {
            const o = simObjs[k];
            if(!o.published) return; 
            let maxObjPrize = 0;
            if(o.isFixed) {
                maxObjPrize = (o.paliers && o.paliers[0]) ? parse(o.paliers[0].prize) : 0;
            } else {
                if(o.paliers) o.paliers.forEach(p => maxObjPrize += parse(p.prize));
            }
            totalPotential35h += maxObjPrize;
            let objTotalCost = 0;
            let totalUserRatio = 0;
            Object.values(allUsers).forEach(u => { totalUserRatio += (u.hours/BASE_HOURS); });
            objTotalCost = maxObjPrize * totalUserRatio;
            const div = document.createElement("div"); div.className = "cockpit-obj-row";
            let slidersHtml = "";
            if(o.isFixed) {
                const prize = (o.paliers && o.paliers[0]) ? parse(o.paliers[0].prize) : 0;
                slidersHtml = `<div class="slider-row"><div class="slider-label-line"><span class="slider-label">Prime Fixe</span><span class="slider-val" id="val-${k}-0">${prize}€</span></div><input type="range" min="0" max="50" step="5" value="${prize}" oninput="updateObjVal('${k}', 0, this.value)"></div>`;
            } else {
                (o.paliers || []).forEach((p, i) => {
                    const prize = parse(p.prize);
                    let label = `Palier ${p.threshold}`;
                    if(o.isNumeric) label += ""; else label += "%";
                    slidersHtml += `<div class="slider-row"><div class="slider-label-line"><span class="slider-label">${label}</span><span class="slider-val" id="val-${k}-${i}">${prize}€</span></div><input type="range" min="0" max="30" step="5" value="${prize}" oninput="updateObjVal('${k}', ${i}, this.value)"></div>`;
                });
            }
            div.innerHTML = `
              <button class="cockpit-obj-head" type="button" onclick="toggleCockpitObj(this)">
                <div class="cockpit-obj-title">
                  <span>${o.name}</span>
                  <span class="cost">Coût équipe : ${objTotalCost.toFixed(0)}€</span>
                </div>
                <span class="cockpit-chevron">▾</span>
              </button>
              <div class="cockpit-obj-body">
                ${slidersHtml}
              </div>
            `; 
            container.appendChild(div);
        });
        document.getElementById("simTotalPerUser").innerText = `${totalPotential35h.toFixed(0)}€`;
        updateSim();
    }
    function updateObjVal(objId, tierIdx, val) {
        document.getElementById(`val-${objId}-${tierIdx}`).innerText = val + "€";
        if(simObjs[objId].paliers && simObjs[objId].paliers[tierIdx]) { simObjs[objId].paliers[tierIdx].prize = val; }
        updateSim();
    }
    
    function toggleCockpitObj(btn){
      try{
        const row = btn.closest('.cockpit-obj-row');
        if(!row) return;
        row.classList.toggle('open');
      }catch(e){}
    }

function updateSim() {
       const budget = parseFloat(document.getElementById("simGlobalBudget").value) || 0;
       let totalUserRatio = 0;
       Object.values(allUsers).forEach(u => { totalUserRatio += (u.hours/BASE_HOURS); });
       let maxLiability = 0;
       let totalPotential35h = 0;
       Object.keys(simObjs).forEach(k => {
           const o = simObjs[k];
           if(!o.published) return;
           let maxP = 0;
           if(o.isFixed) { maxP = (o.paliers && o.paliers[0]) ? parse(o.paliers[0].prize) : 0; } 
           else { if(o.paliers) o.paliers.forEach(p => maxP += parse(p.prize)); }
           const objCost = maxP * totalUserRatio;
           const costLabel = document.getElementById(`cost-${k}`);
           if(costLabel) costLabel.innerText = `Coût équipe : ${objCost.toFixed(0)}€`;
           maxLiability += objCost;
           totalPotential35h += maxP;
       });
       const pct = (budget > 0) ? (maxLiability / budget) * 100 : 0;
       const bar = document.getElementById("simGauge");
       bar.style.width = Math.min(pct, 100) + "%";
       if(maxLiability > budget) { bar.classList.add("danger"); document.getElementById("simUsed").style.color = "#ef4444"; } 
       else { bar.classList.remove("danger"); document.getElementById("simUsed").style.color = "#3b82f6"; }
       document.getElementById("simUsed").innerText = `${maxLiability.toFixed(0)}€ Engagés`;
       document.getElementById("simLeft").innerText = `Reste : ${(budget - maxLiability).toFixed(0)}€`;
       document.getElementById("simTotalPerUser").innerText = `${totalPotential35h.toFixed(0)}€`;
    }
    function publishSim() {
        if(confirm("📡 Confirmer la publication des nouveaux montants ?")) {
            const updates = {};
            if(currentUser && currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
                const newBudget = parseFloat(document.getElementById("simGlobalBudget").value);
                db.ref('settings/budget').set(newBudget);
            }
            Object.keys(simObjs).forEach(k => { updates['objectives/' + k + '/paliers'] = simObjs[k].paliers; });
            db.ref().update(updates).then(() => { showToast("✅ Pilotage Appliqué !"); logAction("Pilotage", "Mise à jour globale budget & primes"); });
        }
    }

    function renderNativeCalendar() {
        const m = currentCalDate.getMonth();
        const y = currentCalDate.getFullYear();
        document.getElementById("calTitle").innerText = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentCalDate);
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);
        const grid = document.getElementById("calGrid");
        const legend = document.getElementById("calLegend");
        grid.innerHTML = "";
        legend.innerHTML = ""; 
        let dayOfWeek = firstDay.getDay() - 1; if(dayOfWeek === -1) dayOfWeek = 6; 
        for(let i=0; i<dayOfWeek; i++) { grid.appendChild(document.createElement("div")); }
        for(let d=1; d<=lastDay.getDate(); d++) {
            const cell = document.createElement("div"); cell.className = "cal-cell";
            cell.innerHTML = `<span class="cal-date">${d}</span>`;
            const cellDate = new Date(y, m, d);
            calEvents.forEach(evt => {
                const s = new Date(evt.start); const e = new Date(evt.end);
                if(cellDate.setHours(0,0,0,0) >= s.setHours(0,0,0,0) && cellDate.setHours(0,0,0,0) <= e.setHours(0,0,0,0)) {
                    cell.innerHTML += `<span class="cal-event-dot ${evt.c}">${evt.t}</span>`;
                }
            });
            grid.appendChild(cell);
        }
        const uniqueEvents = [...new Map(calEvents.map(item => [item.t, item])).values()];
        uniqueEvents.forEach(evt => {
            const legItem = document.createElement("div");
            legItem.className = "legend-item";
            legItem.innerHTML = `<div class="legend-dot ${evt.c}"></div><span>${evt.t}</span>`;
            legend.appendChild(legItem);
        });
    }
    function prevMonth() { currentCalDate.setMonth(currentCalDate.getMonth()-1); renderNativeCalendar(); }
    function nextMonth() { currentCalDate.setMonth(currentCalDate.getMonth()+1); renderNativeCalendar(); }

    
    // --- UI helpers (safe: no impact on Firebase/data) ---
    function formatEuro(v){
      const n = Number(v||0);
      return (isFinite(n)? n.toFixed(2): "0.00") + "€";
    }

    function updateGainToday(totalMyGain){
      if(!currentUser) return;
      const el = document.getElementById("gainToday");
      if(!el) return;

      const uid = currentUser.uid || currentUser.id || "me";
      const key = "gainDayStart_" + uid;
      const today = (new Date()).toLocaleDateString("fr-FR");

      let state = null;
      try { state = JSON.parse(localStorage.getItem(key) || "null"); } catch(e){ state = null; }

      // reset at day change
      if(!state || state.day !== today){
        state = { day: today, start: Number(totalMyGain||0) };
        try { localStorage.setItem(key, JSON.stringify(state)); } catch(e){}
      }

      const delta = Number(totalMyGain||0) - Number(state.start||0);
      const sign = delta >= 0 ? "+" : "";
      el.textContent = `${sign}${delta.toFixed(2)}€ aujourd’hui`;
    }

    
function updateDaysLeft(){
      const el = document.getElementById("daysLeft");
      if(!el) return;
      const now = new Date();
      const lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0);
      const daysLeft = Math.max(0, lastDay.getDate() - now.getDate());
      el.textContent = daysLeft === 0 ? "Dernier jour du mois" : `${daysLeft} jour${daysLeft>1?'s':''} restant${daysLeft>1?'s':''} ce mois`;
}

function computeNextMilestone(userRatio, primOk){
      const el = document.getElementById("nextMilestone");
      if(!el) return;

      // Find the closest *locked* palier among unlocked objectives
      let best = null; // {gap, unit, name, prize}
      let unlockedCount = 0;
      let totalPaliers = 0;

      Object.keys(allObjs||{}).forEach(k=>{
        const o = allObjs[k];
        if(!o || !o.published) return;

        const isLocked = !o.isPrimary && !primOk;
        if(isLocked) return;

        const pct = getPct(o.current, o.target, o.isInverse);

        (o.paliers||[]).forEach(p=>{
          totalPaliers += 1;
          const th = Number(p.threshold);
          const prize = parse(p.prize) * userRatio;

          let unlocked = false;
          if(o.isNumeric) unlocked = Number(o.current) >= th;
          else unlocked = pct >= th;

          if(unlocked){
            unlockedCount += 1;
            return;
          }

          // gap to unlock
          let gap = 0;
          let unit = "";
          if(o.isNumeric){
            gap = th - Number(o.current);
            unit = "";
          } else {
            gap = th - pct;
            unit = "%";
          }
          if(!(gap > 0)) return;

          // score by relative gap (avoid favoring big-number KPIs)
          const denom = (o.isNumeric ? Math.max(1, Math.abs(th)) : 100);
          const score = gap / denom;

          const cand = {
            score,
            gap,
            unit,
            name: (o.name || "Objectif").toString(),
            prize
          };
          if(!best || cand.score < best.score) best = cand;
        });
      });

      // render
      if(totalPaliers > 0 && unlockedCount >= totalPaliers){
        el.textContent = "Tous les paliers sont débloqués 🎉";
      } else if(best){
        const gapTxt = best.unit === "%" ? `${best.gap.toFixed(1)}%` : `${Math.ceil(best.gap)}`;
        el.textContent = `Encore ${gapTxt} sur “${best.name}” pour +${best.prize.toFixed(2)}€`;
      } else {
        el.textContent = "Prochain palier : à portée de main 💪";
      }

      // milestone pulse only when unlockedCount increases
      if(!currentUser) return;
      const uid = currentUser.uid || currentUser.id || "me";
      const key = "unlockedCount_" + uid;
      let prev = 0;
      try { prev = Number(localStorage.getItem(key) || "0"); } catch(e){ prev = 0; }
      if(unlockedCount > prev){
        const sc = document.getElementById("scoreCircle");
        if(sc){
          sc.classList.remove("milestone");
          void sc.offsetWidth;
          sc.classList.add("milestone");
          setTimeout(()=>sc.classList.remove("milestone"), 650);
        }
      }
      try { localStorage.setItem(key, String(unlockedCount)); } catch(e){}
    }


function createSecondaryCarousel(objs, primOk, ratio){
      const wrap = document.createElement("div");
      wrap.className = "secondary-carousel";

      const btnPrev = document.createElement("button");
      btnPrev.className = "carousel-btn prev";
      btnPrev.type = "button";
      btnPrev.setAttribute("aria-label", "Objectifs précédents");
      btnPrev.innerHTML = "<span>‹</span>";

      const btnNext = document.createElement("button");
      btnNext.className = "carousel-btn next";
      btnNext.type = "button";
      btnNext.setAttribute("aria-label", "Objectifs suivants");
      btnNext.innerHTML = "<span>›</span>";

      const track = document.createElement("div");
      track.className = "carousel-track";

      objs.forEach(o => {
        const item = document.createElement("div");
        item.className = "carousel-item";
        item.appendChild(createCard(o, !primOk, ratio, false));
        track.appendChild(item);
      });

      const step = () => Math.max(220, Math.round(track.clientWidth * 0.88));

      btnPrev.addEventListener("click", () => {
        track.scrollBy({ left: -step(), behavior: "smooth" });
      });
      btnNext.addEventListener("click", () => {
        track.scrollBy({ left: step(), behavior: "smooth" });
      });

      // Masquer les flèches si 0/1 élément
      if(objs.length <= 1){
        btnPrev.style.display = "none";
        btnNext.style.display = "none";
      }

      wrap.appendChild(btnPrev);
      wrap.appendChild(btnNext);
      wrap.appendChild(track);
      return wrap;
}

function renderDashboard() {
      if(!currentUser) return;
      const container = document.getElementById("cardsContainer");
      container.innerHTML = "";
      const ratio = (currentUser.hours || 35) / BASE_HOURS;
      let totalMyGain = 0;
      let totalPotential = 0;
      
      const prims = Object.values(allObjs).filter(o => o.isPrimary && o.published);
      let primOk = true;
      if(prims.length > 0) {
        primOk = prims.every(o => {
           let threshold = 100;
           if(o.isFixed) threshold = 100;
           else if(o.paliers && o.paliers[0]) threshold = o.paliers[0].threshold;
           if(o.isNumeric) return parseFloat(o.current) >= threshold;
           else {
               const pct = getPct(o.current, o.target, o.isInverse);
               return pct >= threshold;
           }
        });
      }

      if(prims.length > 0) container.innerHTML += `<div class="category-title">🔥&nbsp;<span>Priorité Absolue</span></div>`;
      prims.forEach(o => container.appendChild(createCard(o, false, ratio, true)));

      const secs = Object.values(allObjs).filter(o => !o.isPrimary && o.published);
      if(secs.length > 0) container.innerHTML += `<div class="category-title secondary">💎&nbsp;<span>Bonus Déblocables</span></div>`;
      container.appendChild(createSecondaryCarousel(secs, primOk, ratio));

      Object.keys(allObjs).forEach(key => {
        const o = allObjs[key];
        if(!o.published) return;
        const pct = getPct(o.current, o.target, o.isInverse);
        const isLocked = !o.isPrimary && !primOk;

        // potential (incl. locked) for "en attente"
        if(o.isFixed) {
          const prize = (o.paliers && o.paliers[0]) ? parse(o.paliers[0].prize) : 0;
          totalPotential += prize * ratio;
        } else {
          (o.paliers||[]).forEach(p => { totalPotential += parse(p.prize) * ratio; });
        }

        if(!isLocked) {
             if(o.isFixed) {
                 let win = false;
                 if(o.isNumeric) win = parseFloat(o.current) >= o.target;
                 else win = pct >= 100;
                 if(win && o.paliers && o.paliers[0]) totalMyGain += (parse(o.paliers[0].prize) * ratio);
             } else {
                 if(o.paliers) o.paliers.forEach(p => { 
                     let unlocked = false;
                     if(o.isNumeric) unlocked = parseFloat(o.current) >= p.threshold;
                     else unlocked = pct >= p.threshold;
                     if(unlocked) totalMyGain += (parse(p.prize) * ratio); 
                 });
             }
        }
      });

      const d = new Date();
      const gainText = totalMyGain.toFixed(2) + "€";
      const myGainEl = document.getElementById("myTotalGain");
      if(myGainEl) myGainEl.textContent = gainText;

      // UI: résumé (aujourd’hui + prochain palier)
      updateGainToday(totalMyGain);
      computeNextMilestone(ratio, primOk);
      updateDaysLeft();

      // UI: primes en attente (potentiel - acquis)
      const pending = Math.max(0, totalPotential - totalMyGain);
      const pendingEl = document.getElementById('pendingGain');
      if(pendingEl) pendingEl.textContent = `⏳ ${pending.toFixed(2)}€ en attente`;

      // UI: micro feedback (sobre, motivant)
      const microEl = document.getElementById('microMotiv');
      if(microEl){
        let msg = "";
        if(!prims.length){
          msg = "📝 Publie les objectifs pour activer les primes.";
        } else if(!primOk){
          // demandé : ne pas afficher ce message dans le cercle (mode jour & nuit)
          msg = "";
        } else if(pending < 0.01){
          msg = "✅ Tout est débloqué pour ce mois. Maintiens le niveau.";
        } else {
          msg = "🎯 Prochain palier : focus sur le +1 aujourd’hui.";
        }
        microEl.textContent = msg;
        microEl.style.display = msg ? "block" : "none";
      }


      // Money rain disabled (kept for backward compatibility)
      const rainContainer = document.getElementById("moneyRain");
      if(rainContainer) rainContainer.innerHTML = "";

      const lastUpdateEl = document.getElementById("lastUpdate");
      if(lastUpdateEl) lastUpdateEl.textContent = "Mise à jour : " + d.toLocaleDateString('fr-FR');

      // KPI cards
      const kMy = document.getElementById("kpiMyGain");
      if(kMy) kMy.textContent = gainText;

      const publishedCount = Object.values(allObjs || {}).filter(o => o && o.published).length;
      const kAct = document.getElementById("kpiActiveObjs");
      if(kAct) kAct.textContent = publishedCount;

      const bonusCount = Object.values(allObjs || {}).filter(o => o && !o.isPrimary && o.published).length;
      const kBonus = document.getElementById("kpiBonusState");
      const kBonusSub = document.getElementById("kpiBonusSub");
      if(kBonus) kBonus.textContent = primOk ? "Ouverts" : "Verrouillés";
      if(kBonusSub) kBonusSub.textContent = primOk ? (bonusCount + " bonus") : "Priorités requises";

      const kUp = document.getElementById("kpiUpdated");
      if(kUp) kUp.textContent = d.toLocaleDateString('fr-FR');

      // UI: small bump on main circle (motivating, without money rain)
      const sc = document.getElementById("scoreCircle");
      if(sc){
        sc.classList.remove("bump");
        void sc.offsetWidth; // restart animation
        sc.classList.add("bump");
        setTimeout(() => sc.classList.remove("bump"), 240);
      }

      // UI: "Focus du jour" line (simple + motivating)
      const focusTextEl = document.getElementById("focusText");
      const focusEmojiEl = document.getElementById("focusEmoji");
      if(focusTextEl && focusEmojiEl){
        const publishedObjs = Object.values(allObjs || {}).filter(o => o && o.published);
        let winCount = 0;
        publishedObjs.forEach(o => {
          const pct2 = getPct(o.current, o.target, o.isInverse);
          let win = false;
          if(o.isFixed){
            if(o.isNumeric) win = parseFloat(o.current) >= o.target;
            else win = pct2 >= 100;
          } else if(o.paliers && o.paliers[0]){
            const thr = o.paliers[0].threshold;
            if(o.isNumeric) win = parseFloat(o.current) >= thr;
            else win = pct2 >= thr;
          }
          if(win) winCount++;
        });

        const n = publishedObjs.length;
        const dayKey = new Date().toISOString().slice(0,10); // stable per day
        let msgs = [];

        if(n === 0){
          msgs = [{ e: "📝", t: "Publie les objectifs du jour pour lancer la journée." }];
        } else if(!primOk){
          msgs = [{ e: "⚡", t: "Priorités d’abord : débloque le principal pour ouvrir les bonus." }];
        } else if(winCount === n){
          msgs = [{ e: "🎉", t: "Tout est validé : garde ce rythme, c’est parfait." }];
        } else {
          msgs = [
            { e: "🎯", t: "Objectif du jour : +1 palier validé." },
            { e: "🚀", t: `Prochain palier : ${n - winCount} objectif(s) à valider.` },
            { e: "💶", t: "Chaque palier compte : vise le +1 aujourd’hui." }
          ];
        }

        let idx = 0;
        for(let i=0; i<dayKey.length; i++) idx = (idx + dayKey.charCodeAt(i)) % msgs.length;
        const m = msgs[idx] || msgs[0];
        focusEmojiEl.textContent = m.e;
        focusTextEl.textContent = m.t;
      }
}

    function createCard(obj, isLocked, userRatio, isPrimary) {
      const pct = getPct(obj.current, obj.target, obj.isInverse);
      let isWin = false;
      if(obj.isFixed) {
          if(obj.isNumeric) isWin = parseFloat(obj.current) >= obj.target;
          else isWin = pct >= 100;
      } else {
          if(obj.paliers && obj.paliers[0]) {
              if(obj.isNumeric) isWin = parseFloat(obj.current) >= obj.paliers[0].threshold;
              else isWin = pct >= obj.paliers[0].threshold;
          }
      }

      const el = document.createElement("div");
      let cls = "card";
      if(isPrimary) cls += " primary-card";
      if(isLocked) cls += " is-locked";
      if(isWin && !isLocked) cls += " is-winner";
      el.className = cls;

      let badge = "";
      if(isLocked) badge = `<div class="status-badge badge-locked">🔒 DÉBLOQUER L'OBJECTIF PRINCIPAL</div>`;
      else if(isWin) badge = `<div class="status-badge badge-winner">🎉 OBJECTIF VALIDÉ</div>`;
      else if(!isPrimary) badge = `<div class="status-badge badge-ready">💎 BONUS POTENTIEL</div>`;

      let earnedBadge = "";
      let myGain = 0;
      if(obj.isFixed) { 
          let win = false;
          if(obj.isNumeric) win = parseFloat(obj.current) >= obj.target;
          else win = pct >= 100;
          if(win && obj.paliers && obj.paliers[0]) myGain = parse(obj.paliers[0].prize); 
      } else { 
          if(obj.paliers) obj.paliers.forEach(p => { 
             let unlocked = false;
             if(obj.isNumeric) unlocked = parseFloat(obj.current) >= p.threshold;
             else unlocked = pct >= p.threshold;
             if(unlocked) myGain += parse(p.prize); 
          }); 
      }

      if(!isLocked && myGain > 0) earnedBadge = `<div class="earned-badge-container"><div class="earned-badge">💶 Prime gagnée : ${(myGain*userRatio).toFixed(2)}€</div></div>`;

      let middleHtml = "";
      if(obj.isFixed) {
          const prizeAmount = (obj.paliers && obj.paliers[0]) ? parse(obj.paliers[0].prize) : 0;
          middleHtml = `<div class="fixed-bonus-block ${isWin && !isLocked ? 'unlocked' : ''}"><div style="font-size:12px; text-transform:uppercase;">PRIME UNIQUE</div><div style="font-size:24px; font-weight:900;">${(prizeAmount * userRatio).toFixed(2)}€</div><div style="font-size:11px; margin-top:5px;">${isWin && !isLocked ? '✅ ACQUISE' : '🔒 À DÉBLOQUER'}</div></div>`;
      } else {
          middleHtml = `<div class="milestones">`;
          const emojis = ['🥳','🚀','🔥'];
          (obj.paliers||[]).forEach((p, i) => {
               let u = false;
               if(obj.isNumeric) u = parseFloat(obj.current) >= p.threshold;
               else u = pct >= p.threshold;
               const valStep = parse(p.prize);
               const displayVal = (valStep * userRatio).toFixed(2);
               let labelTh = p.threshold + "%";
               if(obj.isNumeric) labelTh = p.threshold; 
               middleHtml += `<div class="ms-item ${u?'unlocked':''}"><div class="ms-threshold">${labelTh}</div><div class="ms-circle">${u?emojis[i%3]:(i+1)}</div><div class="ms-prize">+${displayVal}€</div></div>`;
          });
          middleHtml += `</div>`;
      }

      let targetVal = obj.hideTarget ? '<span style="font-size:20px;">🔒</span>' : obj.target + (obj.isInverse ? '%' : '');
      let currentVal = obj.hideCurrent ? '<span style="font-size:20px;">🔒</span>' : obj.current + (obj.isInverse ? '%' : '');
      if(obj.isNumeric) { targetVal = obj.target; currentVal = obj.current; }
      let percentDisplay = pct.toFixed(1) + '%';
      if(obj.isNumeric) { percentDisplay = `${Math.floor(obj.current)} / ${obj.target}`; } 
      else if(obj.isInverse && pct >= 100) { percentDisplay = 'SUCCÈS'; }

      const w1 = Math.min(pct, 100);
      const w2 = pct > 100 ? Math.min(pct - 100, 100) : 0;

      el.innerHTML = `
        ${badge}
        <div class="card-top">
          <div class="obj-info-group">
             <div class="obj-icon">${isPrimary?'⚡':'💎'}</div>
             <div style="flex:1">
               <h3 style="font-weight:800; font-size:20px; margin-bottom:2px;">${obj.name}</h3>
               <div style="font-size:12px; color:var(--text-muted); font-weight:700;">${isPrimary ? 'OBJECTIF OBLIGATOIRE' : 'BONUS SECONDAIRE'} ${obj.isInverse ? '📉 (Inversé)' : ''}</div>
             </div>
          </div>
        </div>
        <div class="data-boxes-row"><div class="data-box"><span class="data-box-label">ACTUEL</span><span class="data-box-value">${currentVal}</span></div><div class="data-box"><span class="data-box-label">CIBLE ${obj.isInverse ? '(MAX)' : ''}</span><span class="data-box-value">${targetVal}</span></div></div>
        <div class="progress-track"><div class="percent-float">${percentDisplay}</div><div class="progress-fill ${isWin?'green-mode':''}" style="width:${w1}%"></div><div class="progress-overdrive" style="width:${w2}%"></div></div>
        ${middleHtml}${earnedBadge}`;
      return el;
    }

    function toggleAdmin(show) { document.getElementById("adminPanel").classList.toggle("active", show); if(show) { renderAdminUsers(); renderSimulator(); } }
    document.getElementById("btnAdmin").onclick = () => toggleAdmin(true);
    function switchTab(t) {
       document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
       if(t === 'team') document.getElementById('btnTabTeam').classList.add('active');
       if(t === 'objs') document.getElementById('btnTabObjs').classList.add('active');
       if(t === 'logs') document.getElementById('btnTabLogs').classList.add('active');
       if(t === 'feedbacks') document.getElementById('btnTabFeedbacks').classList.add('active');
       
       document.getElementById('tab-team').style.display = t==='team'?'block':'none';
       document.getElementById('tab-objs').style.display = t==='objs'?'block':'none';
       document.getElementById('tab-logs').style.display = t==='logs'?'block':'none';
       document.getElementById('tab-feedbacks').style.display = t==='feedbacks'?'block':'none';
    }
    function toggleCreateInputs() { document.getElementById("createTiersBlock").style.display = document.getElementById("noFixed").checked ? 'none' : 'block'; }
    function toggleEditInputs() { document.getElementById("editTiersBlock").style.display = document.getElementById("eoFixed").checked ? 'none' : 'block'; }

    function addObj() {
       const name = document.getElementById("noName").value.trim();
       const target = document.getElementById("noTarget").value.trim();
       if(name.length < 2) { alert("⚠️ Le NOM est obligatoire."); return; }
       if(target.length < 1) { alert("⚠️ La CIBLE est obligatoire."); return; }
       const isFixed = document.getElementById("noFixed").checked;
       const isNumeric = document.getElementById("noNumeric").checked;
       let paliers = [];
       if(isFixed) { paliers = [{ threshold: 100, prize: "0" }]; } 
       else { paliers = [{threshold: parseFloat(document.getElementById("c_p1t").value)||50, prize: "0"}, {threshold: parseFloat(document.getElementById("c_p2t").value)||100, prize: "0"}, {threshold: parseFloat(document.getElementById("c_p3t").value)||120, prize: "0"}]; }
       const id = "obj-" + Date.now();
       db.ref("objectives/"+id).set({ 
           name: name, 
           target: target, 
           current: 0, 
           published: true, 
           isPrimary: document.getElementById("noPrimary").checked, 
           isInverse: document.getElementById("noInverse").checked, 
           isFixed: isFixed, 
           isNumeric: isNumeric,
           paliers: paliers 
       }).then(() => { showToast("✅ Objectif Ajouté !"); });
       logAction("Création Objectif", name);
    }

    function renderAdminObjs() {
      const pl = document.getElementById("pubList"); pl.innerHTML = "";
      const ol = document.getElementById("objList"); if(ol) ol.innerHTML = "";
      Object.keys(allObjs).forEach(k => {
        const o = allObjs[k];
        const d1 = document.createElement("div"); d1.className="user-item pub-row";
        const state = o.published ? 'ACTIF' : 'INACTIF';
        d1.innerHTML = `
          <div class="user-info">
            <div class="user-header" style="gap:10px;">
              <span class="user-name">${o.name} ${o.isInverse?'📉':''} ${o.isFixed?'🎁':''}</span>
              <span class="pub-state ${o.published?'on':'off'}">${state}</span>
            </div>
            <div class="user-meta">Publication + activation/désactivation</div>
          </div>
          <div class="user-actions">
            <label class="switch" title="Activer / désactiver"><input type="checkbox" ${o.published?'checked':''} onchange="togglePub('${k}', this.checked)"><span class="slider"></span></label>
            <div class="btn-group">
              <button onclick="openEditObj('${k}')" class="action-btn" title="Modifier">✏️</button>
              <button onclick="deleteObj('${k}')" class="action-btn delete" title="Supprimer">🗑️</button>
            </div>
          </div>
        `;
        pl.appendChild(d1);
        if(ol){
        const d2 = document.createElement("div"); d2.className="user-item";
        d2.id = "row-" + k; 
        d2.innerHTML = `<span>${o.name} ${o.isInverse?'📉':''} ${o.isFixed?'🎁':''}</span><div style="display:flex; gap:10px;"><button onclick="openEditObj('${k}')" class="action-btn">✏️</button> <button onclick="deleteObj('${k}')" class="action-btn delete">🗑️</button></div>`;
        ol.appendChild(d2);

        }
      });
    }

    function openEditObj(id) {
      const o = allObjs[id];
      document.getElementById("editObjPanel").classList.add("active");
      document.getElementById("eoId").value = id;
      document.getElementById("eoName").value = o.name;
      document.getElementById("eoCurrent").value = o.current;
      document.getElementById("eoTarget").value = o.target;
      document.getElementById("eoPrimary").checked = o.isPrimary;
      document.getElementById("eoInverse").checked = o.isInverse || false;
      document.getElementById("eoFixed").checked = o.isFixed || false;
      document.getElementById("eoNumeric").checked = o.isNumeric || false;
      toggleEditInputs(); 
      if(o.paliers && o.paliers.length > 0) {
        if(o.isFixed) { document.getElementById("eoFixedPrize").value = o.paliers[0].prize; } 
        else {
            if(o.paliers[0]) { document.getElementById("p1t").value = o.paliers[0].threshold; document.getElementById("p1p").value = o.paliers[0].prize; }
            if(o.paliers[1]) { document.getElementById("p2t").value = o.paliers[1].threshold; document.getElementById("p2p").value = o.paliers[1].prize; }
            if(o.paliers[2]) { document.getElementById("p3t").value = o.paliers[2].threshold; document.getElementById("p3p").value = o.paliers[2].prize; }
        }
      }
      document.getElementById("eoHideTarget").checked = o.hideTarget || false;
      document.getElementById("eoHideCurrent").checked = o.hideCurrent || false;
    }

    function saveObj() {
      const id = document.getElementById("eoId").value;
      const isFixed = document.getElementById("eoFixed").checked;
      let paliers = [];
      const oldP = allObjs[id].paliers || [];
      if(isFixed) { paliers = [{ threshold: 100, prize: oldP[0]?oldP[0].prize:"0" }]; } 
      else { 
          paliers = [
              {threshold: parseFloat(document.getElementById("p1t").value), prize: oldP[0]?oldP[0].prize:"0"}, 
              {threshold: parseFloat(document.getElementById("p2t").value), prize: oldP[1]?oldP[1].prize:"0"}, 
              {threshold: parseFloat(document.getElementById("p3t").value), prize: oldP[2]?oldP[2].prize:"0"}
          ]; 
      }
      db.ref("objectives/"+id).update({ 
          name: document.getElementById("eoName").value, 
          current: document.getElementById("eoCurrent").value, 
          target: document.getElementById("eoTarget").value, 
          isPrimary: document.getElementById("eoPrimary").checked, 
          isInverse: document.getElementById("eoInverse").checked, 
          isFixed: isFixed, 
          isNumeric: document.getElementById("eoNumeric").checked,
          hideTarget: document.getElementById("eoHideTarget").checked, 
          hideCurrent: document.getElementById("eoHideCurrent").checked, 
          paliers: paliers 
      }).then(() => { showToast("✅ Objectif Modifié !"); document.getElementById("editObjPanel").classList.remove("active"); });
      logAction("Modification", "Objectif : " + document.getElementById("eoName").value);
    }

    function deleteObj(id) { if(confirm("🗑️ Supprimer ?")) { db.ref("objectives/"+id).remove().then(() => showToast("🗑️ Supprimé")); logAction("Suppression", `Objectif ${id}`); } }
    function togglePub(id, v) { db.ref("objectives/"+id+"/published").set(v); logAction("Publication", `Objectif ${id}: ${v}`); }
    
    function createUser() { 
        const email = document.getElementById("nuEmail").value; 
        const sec = firebase.initializeApp(firebaseConfig, "Sec"); 
        
        var actionCodeSettings = {
          url: 'https://lafayette-progress.onrender.com', // REDIRECT URL
          handleCodeInApp: false
        };

        sec.auth().createUserWithEmailAndPassword(email, "Temp1234!").then(c => { 
            db.ref('users/'+c.user.uid).set({ name: document.getElementById("nuName").value, hours: parseFloat(document.getElementById("nuHours").value)||35, role: document.getElementById("nuAdmin").checked?'admin':'staff', email: email, status: 'pending' }); 
            sec.auth().sendPasswordResetEmail(email, actionCodeSettings); 
            sec.delete(); 
            showToast("✅ Membre invité !"); 
        }).catch(e => { 
            if(e.code === 'auth/email-already-in-use') {
                if(confirm("⚠️ Ce membre existe déjà ! Voulez-vous lui Renvoyer l'email d'invitation ?")) {
                    sec.auth().sendPasswordResetEmail(email, actionCodeSettings).then(() => {
                        showToast("📩 Invitation renvoyée !");
                        sec.delete();
                    });
                } else {
                    sec.delete();
                }
            } else {
                alert(e.message); 
                sec.delete();
            }
        }); 
    }

    function resendInvite(email) { 
        var actionCodeSettings = {
          url: 'https://lafayette-progress.onrender.com',
          handleCodeInApp: false
        };
        if(confirm("Renvoyer le mail d'activation à " + email + " ?")) {
            auth.sendPasswordResetEmail(email, actionCodeSettings).then(() => showToast("📩 Envoyé !")).catch(e => alert(e.message)); 
        }
    }

    function renderAdminUsers() { 
        const d = document.getElementById("usersList"); d.innerHTML = ""; let totalToPay = 0; 
        Object.keys(allUsers).forEach(k => { 
            const u = allUsers[k]; 
            if(u.email && u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return; 
            const userRatio = (u.hours || 35) / BASE_HOURS; 
            let userBonus = 0; 
            
            const prims = Object.values(allObjs).filter(o => o.isPrimary && o.published); let primOk = true; 
            if(prims.length > 0) { primOk = prims.every(o => { 
                 let threshold = 100;
                 if(o.isFixed) threshold = 100;
                 else if(o.paliers && o.paliers[0]) threshold = o.paliers[0].threshold;
                 if(o.isNumeric) return parseFloat(o.current) >= threshold;
                 else {
                     const pct = getPct(o.current, o.target, o.isInverse); 
                     return pct >= threshold;
                 }
            }); } 
            
            Object.values(allObjs).forEach(o => { if(!o.published) return; 
                const pct = getPct(o.current, o.target, o.isInverse); 
                const isLocked = !o.isPrimary && !primOk; 
                let g = 0; 
                if(o.isFixed) { 
                    let win = false;
                    if(o.isNumeric) win = parseFloat(o.current) >= o.target;
                    else win = pct >= 100;
                    if(win && o.paliers && o.paliers[0]) g = parse(o.paliers[0].prize); 
                } else { 
                    if(o.paliers) o.paliers.forEach(p => { 
                        let unlocked = false;
                        if(o.isNumeric) unlocked = parseFloat(o.current) >= p.threshold;
                        else unlocked = pct >= p.threshold;
                        if(unlocked) g += parse(p.prize); 
                    }); 
                } 
                if(!isLocked) userBonus += (g * userRatio); 
            }); 
            totalToPay += userBonus; 
            
            const div = document.createElement("div"); div.className = "user-item"; 
            const statusClass = (u.status === 'active') ? 'active' : 'pending';
            const statusLabel = (u.status === 'active') ? 'ACTIF' : 'EN ATTENTE';
            let adminBadge = ""; if(u.role === 'admin') adminBadge = `<span class="admin-tag">ADMIN</span>`;

            div.innerHTML = `
                <div class="user-info">
                    <div class="user-header">
                        <span class="user-name">${u.name} ${adminBadge}</span>
                        <div style="display:flex; align-items:center;">
                            <span class="status-dot ${statusClass}"></span>
                            <span class="status-text">${statusLabel}</span>
                        </div>
                    </div>
                    <div class="user-email-sub">${u.email}</div>
                    <div class="user-meta">${u.hours}h</div>
                </div>
                <div class="user-actions">
                    <div class="user-gain">${userBonus.toFixed(2)}€</div>
                    <div class="btn-group">
                      <button onclick="resendInvite('${u.email}')" class="action-btn" title="Renvoyer Invitation">📩</button>
                      <button onclick="editUser('${k}')" class="action-btn" title="Modifier">✏️</button>
                      <button onclick="deleteUser('${k}')" class="action-btn delete" title="Supprimer">🗑️</button>
                    </div>
                </div>`; 
            d.appendChild(div); 
        }); 
        const totalRow = document.createElement("div"); totalRow.className = "total-row"; totalRow.innerHTML = `<span>TOTAL</span><span>${totalToPay.toFixed(2)} €</span>`; d.appendChild(totalRow); 
    }

    function editUser(uid) { const u = allUsers[uid]; document.getElementById("editUserPanel").classList.add("active"); document.getElementById("euId").value = uid; document.getElementById("euName").value = u.name; document.getElementById("euHours").value = u.hours; document.getElementById("euAdmin").checked = (u.role === 'admin'); }
    function saveUser() { db.ref('users/'+document.getElementById("euId").value).update({ name: document.getElementById("euName").value, hours: parseFloat(document.getElementById("euHours").value), role: document.getElementById("euAdmin").checked ? 'admin' : 'staff' }); document.getElementById("editUserPanel").classList.remove("active"); showToast("✅ Modifié"); }
    function deleteUser(uid) { if(confirm("Supprimer ?")) { db.ref('users/'+uid).remove(); showToast("🗑️ Supprimé"); } }

    function deleteUserLogs(targetName) {
        if(confirm("🗑️ Effacer tout l'historique de " + targetName + " ?")) {
            const updates = {};
            Object.keys(allLogs).forEach(k => {
                if(allLogs[k].user === targetName) updates['logs/'+k] = null;
            });
            db.ref().update(updates).then(() => showToast("Historique nettoyé !"));
        }
    }

    function toggleUserLogs(id) {
        const el = document.getElementById(id);
        if(el) el.classList.toggle('open');
    }

    function renderLogs(logs) {
      const container = document.getElementById("logsContainer"); container.innerHTML = "";
      const grouped = {};
      Object.values(logs || {}).forEach(log => {
          if(!grouped[log.user]) grouped[log.user] = { lastSeen: 0, sessions: [], actions: [] };
          if(log.type === 'session') { grouped[log.user].sessions.push(log); if(log.lastSeen > grouped[log.user].lastSeen) grouped[log.user].lastSeen = log.lastSeen; } 
          else { grouped[log.user].actions.push(log); if(log.time > grouped[log.user].lastSeen) grouped[log.user].lastSeen = log.time; }
      });
      const sortedUsers = Object.keys(grouped).sort((a,b) => grouped[b].lastSeen - grouped[a].lastSeen);
      
      sortedUsers.forEach(uName => {
          const g = grouped[uName];
          const d = new Date(g.lastSeen);
          g.sessions.sort((a,b) => b.startTime - a.startTime); g.actions.sort((a,b) => b.time - a.time);
          
          // Generate Safe ID
          const safeId = 'log-group-' + uName.replace(/[^a-zA-Z0-9]/g, '');

          const div = document.createElement("div"); div.className = "log-user-group";
          div.innerHTML = `
             <div class="group-header">
                <div class="group-info" onclick="toggleUserLogs('${safeId}')" style="flex:1;">
                   👤 ${uName} <span style="font-weight:400; font-size:11px; color:var(--text-muted); margin-left:10px;">(Dernière: ${d.toLocaleString()}) ▼</span>
                </div>
                <button onclick="deleteUserLogs('${uName}')" class="btn-clear-hist" title="Effacer historique">🗑️ Effacer</button>
             </div>
             <div class="group-body" id="${safeId}">
                <div><div class="log-col-title">🔌 Connexions</div><div class="log-list" id="sess-${safeId}"></div></div>
                <div><div class="log-col-title">🛠️ Activité</div><div class="log-list" id="act-${safeId}"></div></div>
             </div>`;
          container.appendChild(div);
          
          const sc = document.getElementById(`sess-${safeId}`); 
          if(g.sessions.length===0) sc.innerHTML='<div class="log-entry" style="color:#ccc;">Rien</div>'; 
          else g.sessions.forEach(s=>{ 
              const st=new Date(s.startTime); const m=Math.floor((s.lastSeen-s.startTime)/60000); const dt=(m>60)?Math.floor(m/60)+"h "+(m%60)+"m":m+"m"; 
              sc.innerHTML+=`<div class="log-entry"><span class="log-dot">🟢</span><span class="log-time-s">${st.toLocaleDateString().slice(0,5)} ${st.toLocaleTimeString().slice(0,5)}</span><span class="log-dur">${dt}</span></div>`; 
          });

          const ac = document.getElementById(`act-${safeId}`); 
          if(g.actions.length===0) ac.innerHTML='<div class="log-entry" style="color:#ccc;">Rien</div>'; 
          else g.actions.forEach(a=>{ 
              const at=new Date(a.time); 
              ac.innerHTML+=`<div class="log-entry"><span class="log-dot">🔵</span><span class="log-time-s">${at.toLocaleDateString().slice(0,5)} ${at.toLocaleTimeString().slice(0,5)}</span><span class="log-desc">${a.action} <span style="color:#94a3b8;">${a.detail}</span></span></div>`; 
          });
      });
    }

    function saveGlobalBudget() { const val = parseFloat(document.getElementById("globalBudgetInput").value); if(!isNaN(val)) { db.ref('settings/budget').set(val); showToast("💰 Sauvegardé"); } }
    function checkBudget() {
       const budget = globalSettings.budget || 0; let maxLiability = 0; let totalUserRatio = 0;
       Object.values(allUsers).forEach(u => { if(!u.email || u.email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) totalUserRatio += (u.hours/BASE_HOURS); });
       Object.values(allObjs).forEach(o => { if(!o.published) return; let maxP = 0; if(o.paliers) o.paliers.forEach(p => maxP += parse(p.prize)); maxLiability += (maxP * totalUserRatio); });
       const pct = (maxLiability / budget) * 100; const bar = document.getElementById("simGauge"); bar.style.width = Math.min(pct, 100) + "%";
       if(maxLiability > budget) { bar.classList.add("danger"); document.getElementById("simUsed").style.color = "#ef4444"; } 
       else { bar.classList.remove("danger"); document.getElementById("simUsed").style.color = "#3b82f6"; }
       document.getElementById("simUsed").innerText = `${maxLiability.toFixed(0)}€ Engagés`;
       document.getElementById("simLeft").innerText = `Reste : ${(budget - maxLiability).toFixed(0)}€`;
    }

    function getPct(c, t, isInverse) {
      let cv = parseFloat(String(c).replace(',', '.'));
      let tv = parseFloat(String(t).replace(',', '.'));
      if(isNaN(cv) || isNaN(tv)) return 0;
      if(isInverse) { if(cv > tv) return 0; if(cv <= tv) return 100; return 0; }
      if(!tv) return 0; return (cv/tv)*100;
    }
    function parse(s) { return parseFloat(String(s).replace(/[^0-9.]/g,''))||0; }
