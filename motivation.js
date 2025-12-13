// Motivation strip (safe, UI-only)
// Reads the displayed global score value and shows a simple motivational message.
// Does NOT modify any business logic.

document.addEventListener('DOMContentLoaded', () => {
  const valueEl = document.querySelector('.global-score-value');
  const strip = document.getElementById('motivationStrip');
  const titleEl = document.getElementById('motivationTitle');
  const mainEl = document.getElementById('motivationMain');
  const subEl = document.getElementById('motivationSub');
  if (!valueEl || !strip || !titleEl || !mainEl || !subEl) return;

  const getMax = () => {
    const cfg = Number(window.MONEY_TANK_MAX_EUR);
    return Number.isFinite(cfg) && cfg > 0 ? cfg : 100;
  };

  function parseScore(text) {
    const t = (text || '').trim().replace(',', '.');
    // Accept formats: "42%", "25€", "25.00€", "25.00 %" etc.
    const isPercent = /%/.test(t);
    const num = parseFloat(t.replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(num)) return { kind: 'unknown', value: 0 };
    return { kind: isPercent ? 'percent' : 'euro', value: num };
  }

  function render() {
    const max = getMax();
    const { kind, value } = parseScore(valueEl.textContent);

    let pct = 0;
    let euro = 0;

    if (kind === 'percent') {
      pct = Math.max(0, Math.min(100, value));
      euro = (pct / 100) * max;
    } else if (kind === 'euro') {
      euro = Math.max(0, value);
      pct = Math.max(0, Math.min(100, (euro / max) * 100));
    }

    const remaining = Math.max(0, max - euro);
    titleEl.textContent = 'Objectif du jour';

    if (pct >= 100) {
      mainEl.textContent = '🎉 Objectif atteint — bravo l’équipe !';
      subEl.textContent = `Prime max atteinte (${max.toFixed(0)}€). Continuez pour consolider.`;
    } else {
      mainEl.textContent = `Encore ${remaining.toFixed(0)}€ pour débloquer le maximum`;
      subEl.textContent = `Progression actuelle : ${pct.toFixed(0)}% (≈ ${euro.toFixed(0)}€ / ${max.toFixed(0)}€)`;
    }
  }

  // Observe updates
  const obs = new MutationObserver(render);
  obs.observe(valueEl, { childList: true, subtree: true, characterData: true });
  render();
});
