// Navigation menu behaviour and section switching
(() => {
  const toggleBtn = document.getElementById('menu-toggle');
  const sideMenu = document.getElementById('side-menu');
  const overlay = document.getElementById('menu-overlay');

  // Elements for section switching
  const dashboardLink = document.querySelector('#side-menu a[href="#dashboard"]');
  const contactsLink = document.querySelector('#side-menu a[href="#contacts-section"]');
  const sitesLink = document.querySelector('#side-menu a[href="#sites-utiles-section"]');

  // Section elements
  const appContent = document.getElementById('appContent');
  const contactsSection = document.getElementById('contacts-section');
  const sitesSection = document.getElementById('sites-utiles-section');

  // Guard if menu elements don't exist
  if (!toggleBtn || !sideMenu || !overlay) return;

  // Hide the menu until the user is authenticated. Once the auth state changes,
  // show or hide the menu toggle and related elements accordingly.
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(user => {
      if (toggleBtn) {
        toggleBtn.style.display = user ? 'block' : 'none';
      }
      if (sideMenu) {
        sideMenu.style.display = user ? '' : 'none';
      }
      if (overlay) {
        overlay.style.display = user ? '' : 'none';
      }
    });
  } else {
    // If Firebase auth isn't available, hide the menu in case of anonymous state
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (sideMenu) sideMenu.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
  }

  function openMenu() {
    sideMenu.classList.add('open');
    overlay.classList.add('active');
  }

  function closeMenu() {
    sideMenu.classList.remove('open');
    overlay.classList.remove('active');
  }

  toggleBtn.addEventListener('click', () => {
    if (sideMenu.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay.addEventListener('click', closeMenu);

  // Helper to show the selected section and hide others
  function showSection(name) {
    if (appContent) appContent.style.display = (name === 'dashboard') ? 'block' : 'none';
    if (contactsSection) contactsSection.style.display = (name === 'contacts') ? 'block' : 'none';
    if (sitesSection) sitesSection.style.display = (name === 'sites-utiles') ? 'block' : 'none';
    closeMenu();
  }

  if (dashboardLink) {
    dashboardLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('dashboard');
    });
  }

  if (contactsLink) {
    contactsLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('contacts');
    });
  }

  if (sitesLink) {
    sitesLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('sites-utiles');
    });
  }

  // The default visibility of sections is managed by the application.  
  // Do not override the initial display state here to avoid showing sensitive content before login.
})();