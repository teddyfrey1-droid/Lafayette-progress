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