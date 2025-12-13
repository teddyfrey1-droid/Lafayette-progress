/* ============================================================
   MONEY TANK ("Squid Game")

   - Bills fall from the top INSIDE the global score circle.
   - Bills accumulate from the bottom and the pile height follows progress.
   - Reads ONLY the displayed value in `.global-score-value` (no business logic changes).

   Configuration (optional):
     window.MONEY_TANK_MAX_EUR = 200;      // if your global score is displayed in euros
     window.MONEY_TANK_MAX_BILLS = 120;    // cap for DOM/perf
   ============================================================ */

(function(){
  const MAX_BILLS_DEFAULT = 120;
  const FALL_DURATION_MS = 900; // quick, "snappy" but not aggressive

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function rand(min, max){ return Math.random() * (max - min) + min; }

  // Parse either "25.00€", "25 €", "25€", or "72%"
  function parseDisplayedValue(text){
    if (!text) return { kind: 'unknown', value: 0 };
    const t = String(text).replace(/\s+/g,'').replace(',', '.');
    if (t.includes('%')){
      const n = parseFloat(t.replace('%',''));
      return { kind: 'percent', value: isFinite(n) ? n : 0 };
    }
    if (t.includes('€')){
      const n = parseFloat(t.replace('€',''));
      return { kind: 'eur', value: isFinite(n) ? n : 0 };
    }
    const n = parseFloat(t);
    return { kind: 'number', value: isFinite(n) ? n : 0 };
  }

  function ratioFromDisplayed(display){
    if (display.kind === 'percent') return clamp(display.value / 100, 0, 1);
    if (display.kind === 'eur'){
      const max = Number(window.MONEY_TANK_MAX_EUR || 100);
      return clamp(max > 0 ? (display.value / max) : 0, 0, 1);
    }
    // fallback: treat "0-100" as percent-ish
    if (display.kind === 'number') return clamp(display.value / 100, 0, 1);
    return 0;
  }

  function injectStylesOnce(){
    if (document.getElementById('moneyTankInlineStyles')) return;
    const style = document.createElement('style');
    style.id = 'moneyTankInlineStyles';
    style.textContent = `
      .money-tank-overlay{ position:absolute; inset:0; border-radius:50%; overflow:hidden; z-index:2; pointer-events:none; }
      .money-tank-overlay::before{ content:""; position:absolute; inset:0; border-radius:50%; background: radial-gradient(circle at 50% 55%, rgba(0,0,0,.12), rgba(0,0,0,.22)); }
      .money-pile{ position:absolute; inset:0; border-radius:50%; overflow:hidden; }
      .tank-bill{ position:absolute; top:-42px; width:28px; height:18px; border-radius:4px; 
        background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,255,255,.75));
        box-shadow: 0 10px 18px rgba(0,0,0,.22);
        transform: translateY(0) rotate(0deg);
        opacity:.96;
      }
      .tank-bill::after{ content:"💶"; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:16px; filter: drop-shadow(0 2px 2px rgba(0,0,0,.25)); }
      .tank-bill.settled{ box-shadow: 0 6px 14px rgba(0,0,0,.20); }
    `;
    document.head.appendChild(style);
  }

  function createOverlay(container){
    let overlay = container.querySelector('.money-tank-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'money-tank-overlay';
    const pile = document.createElement('div');
    pile.className = 'money-pile';
    overlay.appendChild(pile);
    container.appendChild(overlay);
    return overlay;
  }

  function getPile(container){
    return container.querySelector('.money-tank-overlay .money-pile');
  }

  function bumpScore(container){
    container.classList.remove('score-bump');
    // force reflow
    void container.offsetWidth;
    container.classList.add('score-bump');
  }

  function placeSettledBill(bill, x, y, rot){
    bill.style.left = `${x}px`;
    bill.style.top  = `${y}px`;
    bill.style.transform = `translateY(0) rotate(${rot}deg)`;
    bill.classList.add('settled');
  }

  function spawnFallingBill(pile, targetX, targetY, rot){
    const bill = document.createElement('div');
    bill.className = 'tank-bill';
    pile.appendChild(bill);

    const startX = clamp(targetX + rand(-30, 30), 0, pile.clientWidth - 28);
    bill.style.left = `${startX}px`;
    bill.style.top = `-42px`;
    bill.style.transform = `translateY(0) rotate(${rot}deg)`;

    // Use Web Animations API for smoothness
    const anim = bill.animate([
      { transform: `translateY(0) rotate(${rot}deg)` },
      { transform: `translateY(${targetY + 42}px) rotate(${rot}deg)` }
    ], {
      duration: FALL_DURATION_MS + rand(-120, 180),
      easing: 'cubic-bezier(.2,.9,.2,1)'
    });

    anim.onfinish = () => {
      placeSettledBill(bill, targetX, targetY, rot);
    };
  }

  function updateTank(container, displayText){
    const pile = getPile(container);
    if (!pile) return;

    const display = parseDisplayedValue(displayText);
    const ratio = ratioFromDisplayed(display);

    const maxBills = Number(window.MONEY_TANK_MAX_BILLS || MAX_BILLS_DEFAULT);
    const desired = Math.round(ratio * maxBills);

    const w = pile.clientWidth;
    const h = pile.clientHeight;
    if (!w || !h) return;

    // Pile grows up to ~72% of the circle height (looks natural)
    const pileHeight = Math.max(0, Math.round(ratio * h * 0.72));
    const topLimit = h - pileHeight;

    const existing = Array.from(pile.querySelectorAll('.tank-bill'));
    const count = existing.length;

    // Remove bills if we decreased
    if (count > desired){
      for (let i = count - 1; i >= desired; i--){
        existing[i].remove();
      }
      return;
    }

    // Add bills progressively (only a few per frame for perf)
    const toAdd = desired - count;
    const batch = Math.min(toAdd, 6);

    for (let i = 0; i < batch; i++){
      const sizeW = 28;
      const sizeH = 18;
      const x = Math.floor(rand(6, w - sizeW - 6));
      const y = Math.floor(rand(Math.max(6, topLimit), h - sizeH - 6));
      const rot = Math.floor(rand(-18, 18));
      spawnFallingBill(pile, x, y, rot);
    }

    if (toAdd > batch){
      requestAnimationFrame(() => updateTank(container, displayText));
    }
  }

  function init(){
    const container = document.querySelector('.global-score-container');
    const valueEl = document.querySelector('.global-score-value');
    if (!container || !valueEl) return;

    // Hide legacy confetti effect if present
    const rain = container.querySelector('.money-rain');
    if (rain) rain.style.display = 'none';

    injectStylesOnce();
    createOverlay(container);
    bumpScore(container);

    // Initial render
    updateTank(container, valueEl.textContent);

    // Observe score changes
    const obs = new MutationObserver(() => {
      bumpScore(container);
      updateTank(container, valueEl.textContent);
    });
    obs.observe(valueEl, { characterData: true, childList: true, subtree: true });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
