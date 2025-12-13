// Simple top-right menu controller (safe, no dependencies)
(() => {
  const btn = document.getElementById('appMenuBtn');
  const menu = document.getElementById('appMenu');
  if (!btn || !menu) return;

  const closeMenu = () => {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.classList.contains('open')) closeMenu();
    else openMenu();
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('open')) return;
    if (!menu.contains(e.target) && e.target !== btn) closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // Expose a safe hook for Admin button.
  window.tryOpenAdmin = () => {
    closeMenu();
    // If an admin panel toggler exists in your codebase, call it.
    if (typeof window.openAdminPanel === 'function') {
      window.openAdminPanel();
      return;
    }
    // Fallback: scroll to an admin section if present.
    const el = document.getElementById('adminPanel') || document.querySelector('.admin-panel');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (typeof window.showToast === 'function') window.showToast("Accès admin indisponible sur cette page.");
  };
})();
