// 1. Config with NO backend requirement for now
const CONFIG = { 
    arcMin: 1.2, 
    arcMax: 3.5, 
    baseSpeed: 0.025, 
    visionDecay: 0.0009, 
    streaks: { 10: 2, 20: 3 } 
};

// 2. Element Selectors
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo-ui');
const visionBar = document.getElementById('vision-bar');
const bgMusic = document.getElementById('bgMusic');

// 3. Game State
let score = 0, combo = 0, running = false, vision = 1.0;
let ballPos = 0, lastTime = 0, targetS = 0, targetE = 0, targetHit = true, isBoosting = false;
const cx = 300, cy = 300, r = 220, PI2 = Math.PI * 2, OFFSET = -Math.PI/2;

// 4. UI Logic (The "Anti-Blur" Fix)
function showCard(id) {
    // Hide all cards
    document.querySelectorAll('.ui-card').forEach(c => c.style.display = 'none');
    
    const uiLayer = document.getElementById('ui-layer');
    if (id === 'none') {
        uiLayer.style.opacity = '0';
        uiLayer.style.pointerEvents = 'none';
        setTimeout(() => { uiLayer.style.visibility = 'hidden'; }, 400);
    } else {
        uiLayer.style.visibility = 'visible';
        uiLayer.style.opacity = '1';
        uiLayer.style.pointerEvents = 'auto';
        const target = document.getElementById(id);
        if (target) target.style.display = 'flex';
    }
}

// 5. Core Game Functions
function spawnTarget() {
    targetHit = false;
    let baseWidth = Math.max(0.12, 0.5 - (score * 0.0004));
    let arcDist = CONFIG.arcMin + Math.random() * (CONFIG.arcMax - CONFIG.arcMin);
    targetS = (ballPos + arcDist) % PI2;
    targetE = (targetS + baseWidth) % PI2;
}

function update(t) {
    if (!running || isBoosting) return;
    const dt = (t - lastTime) / 16.6; 
    lastTime = t;

    ctx.clearRect(0, 0, 600, 600);
    
    // Draw Track
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); ctx.strokeStyle = "#111"; ctx.lineWidth = 30; ctx.stroke();
    
    // Draw Target
    if (!targetHit) {
        ctx.beginPath(); ctx.strokeStyle = "#00f2ff"; 
        ctx.arc(cx, cy, r, targetS + OFFSET, targetE + OFFSET); ctx.stroke();
    }

    // Move Ball
    ballPos = (ballPos + (CONFIG.baseSpeed + (score * 0.0001)) * dt) % PI2;
    const bx = cx + Math.cos(ballPos + OFFSET) * r;
    const by = cy + Math.sin(ballPos + OFFSET) * r;
    
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bx, by, 15, 0, PI2); ctx.fill();

    // Vision Decay
    vision -= CONFIG.visionDecay * dt;
    visionBar.style.width = (vision * 100) + '%';
    scoreEl.innerText = Math.floor(score);

    if (vision <= 0) {
        running = false;
        showCard('game-over-card');
        document.getElementById('final-score-display').innerText = Math.floor(score);
    } else {
        requestAnimationFrame(update);
    }
}

// 6. Interaction
function handleInput() {
    if (!running) return;
    const p = ballPos % PI2;
    const s = targetS % PI2, e = targetE % PI2;
    const hit = s < e ? (p >= s && p <= e) : (p >= s || p <= e);

    if (hit && !targetHit) {
        targetHit = true; combo++;
        score += (combo >= 10 ? 2 : 1);
        vision = Math.min(1.0, vision + 0.1);
        spawnTarget();
    } else {
        combo = 0; vision -= 0.15;
    }
    comboEl.innerText = `STREAK: ${combo}`;
}

// 7. Global Controls
window.registerPilot = () => showCard('main-menu');
window.startGame = () => {
    showCard('none');
    score = 0; combo = 0; vision = 1.0; running = true;
    lastTime = performance.now();
    spawnTarget();
    requestAnimationFrame(update);
};

// INITIALIZE
window.onload = () => {
    console.log("Game Initialized");
    showCard('welcome-screen');
};

window.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'BUTTON') handleInput();
});
