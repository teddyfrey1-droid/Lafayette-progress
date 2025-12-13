// Money Tank effect inside the global score circle
// This script creates falling bills that accumulate inside the circle and fill it
// proportionally to the displayed score. It also hides the original money-rain effect.

document.addEventListener('DOMContentLoaded', function () {
    const container = document.querySelector('.global-score-container');
    const valueEl = document.querySelector('.global-score-value');
    if (!container || !valueEl) return;

    // Ensure the container is positioned relative so absolute elements align correctly
    if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }

    // Hide any existing money rain effect
    const rainEl = container.querySelector('.money-rain');
    if (rainEl) {
        rainEl.style.display = 'none';
    }

    // Create the tank container if it doesn't exist
    let tank = container.querySelector('.money-tank');
    if (!tank) {
        tank = document.createElement('div');
        tank.className = 'money-tank';
        container.appendChild(tank);
    }

    // Inject styles once into the document head. These styles control the tank and bills.
    if (!document.querySelector('#money-tank-styles')) {
        const style = document.createElement('style');
        style.id = 'money-tank-styles';
        style.textContent = `
            /* Hide the default rain effect in the global score */
            .global-score-container .money-rain { display: none !important; }
            /* Tank takes up the full circle area */
            .global-score-container .money-tank {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
                border-radius: 50%;
                pointer-events: none;
            }
            /* Each bill starts above the tank and falls to its final position */
            .global-score-container .tank-bill {
                position: absolute;
                bottom: 0;
                opacity: 0;
                transform: translateY(-120%);
                animation: moneyTankDrop 1s ease-out forwards;
            }
            @keyframes moneyTankDrop {
                from { transform: translateY(-120%); opacity: 1; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Maximum number of bills that can be shown at 100%/100€ (adjust as needed)
    const MAX_BILLS = 40;
    /**
     * Parse the numeric value out of the score text.
     * If a percent sign is present, treat it as a percentage (0‑100).
     * Otherwise, treat the value as euros and map to a percentage
     * based on a default maximum (100) to avoid overfilling.
     */
    function parseRatio(text) {
        const cleaned = text.replace(/[^\d,\.\%]/g, '');
        const num = parseFloat(cleaned.replace(',', '.')) || 0;
        if (cleaned.includes('%')) {
            return Math.min(num / 100, 1);
        }
        // Default maximum for euros (can be configured globally)
        const cfg = Number(window.MONEY_TANK_MAX_EUR);
        const MAX_EURO = (Number.isFinite(cfg) && cfg > 0) ? cfg : 100;
        return Math.min(num / MAX_EURO, 1);
    }
    /**
     * Render the falling bills based on the current score.
     */
    function renderBills() {
        const ratio = parseRatio(valueEl.textContent.trim());
        const count = Math.floor(MAX_BILLS * ratio);
        // Remove existing bills
        tank.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const bill = document.createElement('div');
            bill.className = 'tank-bill';
            bill.textContent = '💸';
            // Random horizontal position within the circle
            bill.style.left = Math.random() * 90 + '%';
            // Random animation delay so bills don't all fall at once
            bill.style.animationDelay = (Math.random() * 1.0) + 's';
            // Random size variation
            bill.style.fontSize = (14 + Math.random() * 10) + 'px';
            // Assign a bottom offset to stack bills gradually; up to 70% height
            const bottomOffset = (i / (count || 1)) * 70; // 0 to 70%
            bill.style.bottom = bottomOffset + '%';
            tank.appendChild(bill);
        }
    }
    // Initial render
    renderBills();
    // Observe changes to the score value
    const observer = new MutationObserver(renderBills);
    observer.observe(valueEl, { childList: true, characterData: true, subtree: true });
});