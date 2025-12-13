(() => {
  const $ = (sel) => document.querySelector(sel);
  const toggle = $("#menu-toggle");
  const menu = $("#side-menu");
  const closeBtn = $("#menu-close");
  const overlay = $("#menu-overlay");
  const views = {
    dashboard: $("#view-dashboard"),
    contacts: $("#view-contacts"),
    "sites-utiles": $("#view-sites-utiles"),
  };

  if (!toggle || !menu || !overlay || !views.dashboard) return;

  const openMenu = () => {
    menu.classList.add("open");
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  };

  const closeMenu = () => {
    menu.classList.remove("open");
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
  };

  const showView = (name) => {
    const key = views[name] ? name : "dashboard";
    Object.entries(views).forEach(([k, el]) => {
      if (!el) return;
      const isActive = k === key;
      if (isActive) {
        el.hidden = false;
        el.classList.add("active");
      } else {
        el.hidden = true;
        el.classList.remove("active");
      }
    });
  };

  const routeFromHash = () => {
    const h = (location.hash || "#dashboard").replace("#", "");
    showView(h);
  };

  // Click handlers
  toggle.addEventListener("click", openMenu);
  overlay.addEventListener("click", closeMenu);
  if (closeBtn) closeBtn.addEventListener("click", closeMenu);

  menu.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-view]");
    if (!a) return;
    e.preventDefault();
    const view = a.getAttribute("data-view");
    showView(view);
    // Update hash (keeps back/forward behavior)
    if (view) location.hash = view;
    closeMenu();
  });

  window.addEventListener("hashchange", routeFromHash);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // Init
  routeFromHash();
})();
