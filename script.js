// 1. CONFIG & STATE
let CONFIG = { 
    arcMin: 1.2, arcMax: 3.5, baseSpeed: 0.025, 
    visionDecay: 0.0009, streaks: { 10: 2, 20: 3 }
};

let audioCtx, masterGain, bgMusic = document.getElementById('bgMusic');
let score = 0, combo = 0, running = false, vision = 1.0;
let ballPos = 0, lastTime = 0, targetS = 0, targetE = 0, targetHit = true, isBoosting = false;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cx = 300, cy = 300, r = 220, PI2 = Math.PI * 2, OFFSET = -Math.PI/2;

// 2. STABLE LAYOUT ENGINE (Desktop & Mobile Friendly)
function resize() {
    const wrapper = document.getElementById('game-wrapper'); // New wrapper for containment
    if (!wrapper) return;

    // Determine the best fit for the square game
    const availableSize = Math.min(window.innerWidth, window.innerHeight);
    const size = Math.min(availableSize, 600);
    
    wrapper.style.width = size + "px";
    wrapper.style.height = size + "px";
    
    canvas.width = 600;
    canvas.height = 600;
}
window.addEventListener('resize', resize);
window.addEventListener('load', resize);
resize();

// 3. CORE GAMEPLAY (Score + Variable Targets)
function spawnTarget() {
    targetHit = false;
    const multipliers = [1.0, 0.7, 0.5];
    const mod = multipliers[Math.floor(Math.random() * multipliers.length)];
    let baseWidth = Math.max(0.15, 0.5 - (score * 0.0003));
    let finalWidth = baseWidth * mod;

    let arcDist = CONFIG.arcMin + Math.random() * (CONFIG.arcMax - CONFIG.arcMin);
    targetS = (ballPos + arcDist) % PI2;
    targetE = (targetS + finalWidth) % PI2;
}

function update(t) {
    if (!running) return;
    const dt = Math.min((t - lastTime) / 16.6, 2); 
    lastTime = t;

    ctx.clearRect(0,0,600,600);
    
    // Draw Track
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); 
    ctx.strokeStyle = "#111"; ctx.lineWidth = 30; ctx.stroke();
    
    // Target
    if (!targetHit && !isBoosting) {
        ctx.beginPath(); ctx.strokeStyle = "#00f2ff"; ctx.lineWidth = 35;
        if (targetS < targetE) {
            ctx.arc(cx, cy, r, targetS + OFFSET, targetE + OFFSET);
        } else {
            ctx.arc(cx, cy, r, targetS + OFFSET, PI2 + OFFSET);
            ctx.stroke(); ctx.beginPath();
            ctx.arc(cx, cy, r, OFFSET, targetE + OFFSET);
        }
        ctx.stroke();
    }

    let currentSpeed = isBoosting ? 0.35 : (CONFIG.baseSpeed + (score * 0.0001));
    ballPos = (ballPos + currentSpeed * dt) % PI2;
    
    // Ball
    const bx = cx + Math.cos(ballPos + OFFSET) * r;
    const by = cy + Math.sin(ballPos + OFFSET) * r;
    ctx.fillStyle = "white";
    ctx.beginPath(); ctx.arc(bx, by, 15, 0, PI2); ctx.fill();

    if (!isBoosting) {
        vision -= CONFIG.visionDecay * dt;
        if (vision <= 0) endGame();
    }

    document.getElementById('vision-bar').style.width = (vision * 100) + '%';
    document.getElementById('score').innerText = Math.floor(score);
    requestAnimationFrame(update);
}

// 4. ACTIONS & UI
window.handleBoost = () => {
    showCard('none');
    score += 100; // Flat 100
    isBoosting = true; running = true; lastTime = performance.now();
    setTimeout(() => { isBoosting = false; spawnTarget(); }, 2000);
    requestAnimationFrame(update);
};

window.startGame = () => {
    showCard('none');
    score = 0; combo = 0; vision = 1.0; running = true;
    lastTime = performance.now(); spawnTarget();
    requestAnimationFrame(update);
};

function endGame() {
    running = false;
    showCard('game-over-card');
    document.getElementById('final-score-display').innerText = Math.floor(score);
}

function showCard(id) {
    document.querySelectorAll('.ui-card').forEach(c => c.style.display = 'none');
    const ui = document.getElementById('ui-layer');
    if (id === 'none') {
        ui.style.opacity = '0'; ui.style.visibility = 'hidden';
    } else {
        ui.style.opacity = '1'; ui.style.visibility = 'visible';
        document.getElementById(id).style.display = 'flex';
    }
}

// 5. INPUT HANDLING
const handleInput = (e) => {
    if (!running || isBoosting || e.target.closest('button')) return;
    const p = ballPos % PI2;
    const s = targetS % PI2, e_arc = targetE % PI2;
    const hit = s < e_arc ? (p >= s && p <= e_arc) : (p >= s || p <= e_arc);

    if (hit && !targetHit) {
        targetHit = true; combo++; 
        score += (combo >= 10 ? 2 : 1);
        vision = Math.min(1.0, vision + 0.1);
        spawnTarget();
    } else {
        combo = 0; vision -= 0.15;
    }
    document.getElementById('combo-ui').innerText = `STREAK: ${combo}`;
};

window.addEventListener('mousedown', handleInput);
window.addEventListener('touchstart', (e) => {
    if (e.target.tagName !== 'BUTTON') e.preventDefault();
    handleInput(e);
}, { passive: false });
