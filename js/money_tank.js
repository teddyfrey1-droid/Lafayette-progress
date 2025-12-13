(() => {
  "use strict";

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function parsePercent(text) {
    if (!text) return 0;
    const m = String(text).match(/(\d+(?:[\.,]\d+)?)/);
    if (!m) return 0;
    return clamp(parseFloat(m[1].replace(",", ".")), 0, 100);
  }

  function createCanvasIn(container) {
    let canvas = container.querySelector("canvas.money-tank-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "money-tank-canvas";
      canvas.setAttribute("aria-hidden", "true");
      container.appendChild(canvas);
    }
    const ctx = canvas.getContext("2d", { alpha: true });
    return { canvas, ctx };
  }

  function setup() {
    const scoreEl = document.querySelector(".global-score-value");
    const rainEl = document.querySelector(".global-score-container .money-rain");
    if (!scoreEl || !rainEl) return;

    const { canvas, ctx } = createCanvasIn(rainEl);

    let W = 0, H = 0, dpr = 1;

    function resize() {
      const rect = rainEl.getBoundingClientRect();
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      W = Math.max(1, Math.floor(rect.width));
      H = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const bills = [];
    const MAX_BILLS = 220; // cap for performance
    let targetFill = parsePercent(scoreEl.textContent) / 100;
    let fill = targetFill;

    function spawnBills(count) {
      for (let i = 0; i < count; i++) {
        if (bills.length >= MAX_BILLS) break;
        bills.push({
          x: Math.random() * W,
          y: -20 - Math.random() * 60,
          w: 18 + Math.random() * 10,
          h: 10 + Math.random() * 6,
          rot: (Math.random() - 0.5) * 0.9,
          vr: (Math.random() - 0.5) * 0.02,
          vy: 1.5 + Math.random() * 2.5,
          vx: (Math.random() - 0.5) * 0.7,
          a: 1,
          state: "fall"
        });
      }
    }

    function drawBill(b) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.globalAlpha = b.a;

      // bill body
      const r = 2.5;
      ctx.beginPath();
      const x = -b.w/2, y = -b.h/2, w = b.w, h = b.h;
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, -b.h/2, 0, b.h/2);
      grad.addColorStop(0, "rgba(34,197,94,0.95)");
      grad.addColorStop(1, "rgba(22,163,74,0.95)");
      ctx.fillStyle = grad;
      ctx.fill();

      // inner border
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // center stripe
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.moveTo(-b.w*0.25, 0);
      ctx.lineTo(b.w*0.25, 0);
      ctx.stroke();

      // small circle
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(b.w, b.h) * 0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function tick() {
      // smooth fill level
      fill += (targetFill - fill) * 0.06;

      // decide how many to spawn: more when fill is increasing
      const delta = targetFill - fill;
      const base = 1; // always a tiny rain
      const extra = delta > 0 ? Math.ceil(delta * 40) : 0;
      spawnBills(base + extra);

      // background fade (subtle)
      ctx.clearRect(0, 0, W, H);

      // compute filled region
      const fillH = clamp(fill, 0, 1) * H;
      const topY = H - fillH;

      // subtle "glass" vignette
      const glass = ctx.createRadialGradient(W*0.5, H*0.35, Math.min(W,H)*0.1, W*0.5, H*0.35, Math.max(W,H)*0.7);
      glass.addColorStop(0, "rgba(255,255,255,0.08)");
      glass.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glass;
      ctx.fillRect(0, 0, W, H);

      // bills update
      for (let i = bills.length - 1; i >= 0; i--) {
        const b = bills[i];

        if (b.state === "fall") {
          b.vy += 0.02; // gravity
          b.y += b.vy;
          b.x += b.vx;
          b.rot += b.vr;

          // wrap x
          if (b.x < -30) b.x = W + 30;
          if (b.x > W + 30) b.x = -30;

          const landingY = topY + (H - topY) * (0.15 + Math.random() * 0.8);
          if (b.y >= landingY) {
            b.y = landingY;
            b.state = "rest";
            b.vy = 0;
            b.vx *= 0.2;
            b.vr *= 0.2;
          }
        } else {
          // if fill decreased and bill is now above allowed region, fade it out
          if (b.y < topY) {
            b.a -= 0.03;
            if (b.a <= 0) {
              bills.splice(i, 1);
              continue;
            }
          }
        }

        // remove very old offscreen
        if (b.y > H + 80) {
          bills.splice(i, 1);
          continue;
        }
      }

      // draw bills behind text
      for (const b of bills) drawBill(b);

      requestAnimationFrame(tick);
    }

    // Observe score changes without touching existing logic
    const observer = new MutationObserver(() => {
      targetFill = parsePercent(scoreEl.textContent) / 100;
    });
    observer.observe(scoreEl, { childList: true, characterData: true, subtree: true });

    // resize observers
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(rainEl);
    window.addEventListener("resize", resize, { passive: true });

    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
