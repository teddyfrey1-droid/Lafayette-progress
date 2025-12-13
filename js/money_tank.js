/* ============================================
   MONEY TANK (Squid Game)
   - Bills fall INSIDE the global score circle
   - Pile fills from the bottom based on the displayed global score
   - UI-only: does NOT change business logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.global-score-container');
  const valueEl = document.querySelector('.global-score-value');
  if (!container || !valueEl) return;

  // Hide any legacy flying bills container if present
  const legacy = document.querySelector('.money-rain');
  if (legacy) legacy.style.display = 'none';

  // Create tank overlay
  let tank = container.querySelector('.money-tank');
  if (!tank) {
    tank = document.createElement('div');
    tank.className = 'money-tank';
    container.appendChild(tank);
  }

  function getMax() {
    const cfg = Number(window.MONEY_TANK_MAX_EUR);
    return Number.isFinite(cfg) && cfg > 0 ? cfg : 100;
  }

  function parseScore(text) {
    const t = (text || '').trim().replace(',', '.');
    const isPercent = /%/.test(t);
    const num = parseFloat(t.replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(num)) return { kind: 'percent', value: 0 };
    return { kind: isPercent ? 'percent' : 'euro', value: num };
  }

  // Keep a stable set of bills for performance
  const MAX_BILLS = 42;
  let activeBills = 0;

  function ensureBills(n) {
    n = Math.max(0, Math.min(MAX_BILLS, n));
    if (n === activeBills) return;

    // Add bills
    while (activeBills < n) {
      const b = document.createElement('div');
      b.className = 'tank-bill';
      // start above
      b.style.left = (8 + Math.random() * 84).toFixed(2) + '%';
      b.style.top = (-20 - Math.random() * 60).toFixed(0) + 'px';
      b.style.setProperty('--rot', `${(-18 + Math.random() * 36).toFixed(0)}deg`);
      b.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's';
      tank.appendChild(b);
      activeBills++;
    }

    // Remove bills
    while (activeBills > n) {
      const last = tank.querySelector('.tank-bill:last-child');
      if (last) last.remove();
      activeBills--;
    }

    // Re-stack final positions from bottom
    const bills = Array.from(tank.querySelectorAll('.tank-bill'));
    const rows = Math.ceil(Math.sqrt(Math.max(1, bills.length)));
    const cols = Math.ceil(bills.length / rows);
    const cellH = 7.5; // px
    const baseBottom = 10;
    bills.forEach((b, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = 8 + (c / Math.max(1, cols - 1)) * 84 + (Math.random() * 2 - 1);
      const y = baseBottom + r * cellH + (Math.random() * 2 - 1);
      b.style.setProperty('--final-left', x.toFixed(2) + '%');
      b.style.setProperty('--final-bottom', y.toFixed(0) + 'px');
    });
  }

  function render() {
    const max = getMax();
    const { kind, value } = parseScore(valueEl.textContent);
    let pct = 0;
    if (kind === 'percent') pct = Math.max(0, Math.min(100, value));
    else pct = Math.max(0, Math.min(100, (value / max) * 100));

    const billsToShow = Math.round((pct / 100) * MAX_BILLS);
    ensureBills(billsToShow);
  }

  const obs = new MutationObserver(render);
  obs.observe(valueEl, { childList: true, subtree: true, characterData: true });
  render();
});
