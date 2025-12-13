(() => {
  const $ = (sel) => document.querySelector(sel);

  const toggle = $("#menu-toggle");
  const menu = $("#side-menu");
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
    toggle.setAttribute("aria-expanded", "true");
  };

  const closeMenu = () => {
    menu.classList.remove("open");
    overlay.classList.remove("active");
    toggle.setAttribute("aria-expanded", "false");
  };

  const showView = (key) => {
    // default to dashboard if unknown
    const viewKey = views[key] ? key : "dashboard";
    Object.values(views).forEach((el) => el && el.classList.remove("active"));
    views[viewKey].classList.add("active");
  };

  const routeFromHash = () => {
    const raw = (location.hash || "").replace("#", "").trim();
    if (!raw) {
      showView("dashboard");
      return;
    }
    showView(raw);
  };

  toggle.addEventListener("click", () => {
    if (menu.classList.contains("open")) closeMenu();
    else openMenu();
  });

  overlay.addEventListener("click", closeMenu);

  menu.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-view]");
    if (!link) return;
    e.preventDefault();
    const view = link.getAttribute("data-view");
    // Update hash to preserve back/forward
    location.hash = view;
    closeMenu();
  });

  window.addEventListener("hashchange", routeFromHash);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // Init
  routeFromHash();
})();
