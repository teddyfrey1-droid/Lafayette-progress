// Simple top-right menu (hamburger)
// - Toggles dropdown
// - Closes on outside click and Escape

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('menuDropdown');
  if (!btn || !menu) return;

  const close = () => {
    menu.classList.remove('show');
    btn.setAttribute('aria-expanded', 'false');
  };

  const open = () => {
    menu.classList.add('show');
    btn.setAttribute('aria-expanded', 'true');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.contains('show');
    isOpen ? close() : open();
  });

  document.addEventListener('click', () => close());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
});
