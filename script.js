// 1. CONFIG & STATE
let CONFIG = { 
    arcMin: 1.2, 
    arcMax: 3.5, 
    baseSpeed: 0.025, 
    visionDecay: 0.0009, 
    streaks: { 10: 2, 20: 3 }
};

let audioCtx, masterGain, bgMusic = document.getElementById('bgMusic');
let score = 0, combo = 0, running = false, vision = 1.0;
let ballPos = 0, lastTime = 0, targetS = 0, targetE = 0, targetHit = true, isBoosting = false;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Fixed Center Points & Radius
const cx = 300; 
const cy = 300; 
const r = 220; 
const PI2 = Math.PI * 2; 
const OFFSET = -Math.PI / 2; // Starts at the top (12 o'clock)

// 2. BALANCED AUDIO ENGINE
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.4;
        masterGain.connect(audioCtx.destination);
        
        if (bgMusic) bgMusic.volume = 0.1; 
    }
}

function playSFX(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g); g.connect(masterGain);
    const now = audioCtx.currentTime;

    if (type === 'hit') {
        osc.frequency.setValueAtTime(500 + (combo * 15), now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
    } else if (type === 'fail') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        g.gain.setValueAtTime(0.2, now); g.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(); osc.stop(now + 0.3);
    } else if (type === 'boost_engine') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(60 + (Math.random() * 20), now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        g.gain.setValueAtTime(0.05, now);
        osc.start(); osc.stop(now + 0.1);
    }
}

// 3. UI & RENDER
function showCard(id) {
    document.querySelectorAll('.ui-card').forEach(c => c.style.display = 'none');
    const ui = document.getElementById('ui-layer');
    if (id === 'none') {
        ui.style.display = 'none';
    } else {
        ui.style.display = 'block';
        const target = document.getElementById(id);
        if(target) target.style.display = 'flex';
    }
}

function drawBall(pos, opacity = 1, size = 15) {
    const bx = cx + Math.cos(pos + OFFSET) * r;
    const by = cy + Math.sin(pos + OFFSET) * r;
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    if (opacity > 0.5) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#00f2ff";
    }
    ctx.beginPath(); 
    ctx.arc(bx, by, size, 0, PI2); 
    ctx.fill();
    ctx.shadowBlur = 0;
}

// 4. CORE UPDATE LOOP
function update(t) {
    if (!running) return;
    const dt = Math.min((t - lastTime) / 16.6, 2); 
    lastTime = t;

    // Clear Screen
    ctx.clearRect(0, 0, 600, 600);
    
    // Draw Background Track (The Orbit)
    ctx.beginPath(); 
    ctx.arc(cx, cy, r, 0, PI2); 
    ctx.strokeStyle = "#1a1a1a"; 
    ctx.lineWidth = 20; 
    ctx.stroke();
    
    // Draw Target Arc
    if (!targetHit && !isBoosting) {
        ctx.beginPath(); 
        ctx.strokeStyle = "#00f2ff"; 
        ctx.lineWidth = 25;
        ctx.lineCap = "round";
        ctx.arc(cx, cy, r, targetS + OFFSET, targetE + OFFSET); 
        ctx.stroke();
    }

    // Motion & Difficulty Scaling
    let currentSpeed = isBoosting ? 0.35 : (CONFIG.baseSpeed + (score * 0.0001));
    
    if (isBoosting) {
        score += 0.8 * dt;
        if (Math.random() > 0.8) playSFX('boost_engine');
        // Boost Trail
        for(let i = 1; i <= 8; i++) {
            drawBall(ballPos - (i * 0.08), 1 / (i * 2.5), 12);
        }
    }

    ballPos = (ballPos + currentSpeed * dt) % PI2;
    drawBall(ballPos, 1, 15);

    if (!isBoosting) {
        vision -= CONFIG.visionDecay * dt;
        if (vision <= 0) endGame();
    }

    // Update UI Elements
    document.getElementById('vision-bar').style.width = (vision * 100) + '%';
    document.getElementById('score').innerText = Math.floor(score);
    document.getElementById('combo-ui').innerText = `STREAK: ${combo}`;

    requestAnimationFrame(update);
}

// 5. GAME ACTIONS
function spawnTarget() {
    targetHit = false;
    let baseWidth = Math.max(0.15, 0.5 - (score * 0.0003));
    let arcDist = CONFIG.arcMin + Math.random() * (CONFIG.arcMax - CONFIG.arcMin);
    targetS = (ballPos + arcDist) % PI2;
    targetE = (targetS + baseWidth) % PI2;
}

window.handleBoost = () => {
    initAudio(); 
    showCard('none');
    isBoosting = true; 
    running = true; 
    lastTime = performance.now();
    
    if(bgMusic) {
        bgMusic.currentTime = 0;
        bgMusic.play();
    }
    
    document.getElementById('game-wrapper').classList.add('warping');
    
    setTimeout(() => {
        isBoosting = false;
        document.getElementById('game-wrapper').classList.remove('warping');
        spawnTarget();
    }, 2000);

    requestAnimationFrame(update);
};

function endGame() {
    running = false;
    if(bgMusic) bgMusic.pause();
    playSFX('fail');
    showCard('game-over-card');
    document.getElementById('final-score-display').innerText = Math.floor(score);
}

window.registerPilot = () => { 
    initAudio(); 
    showCard('main-menu'); 
};

window.startGame = () => { 
    initAudio(); 
    showCard('none'); 
    score = 0; combo = 0; vision = 1.0; 
    running = true; 
    lastTime = performance.now(); 
    spawnTarget(); 
    if(bgMusic) {
        bgMusic.currentTime = 0;
        bgMusic.play();
    }
    requestAnimationFrame(update); 
};

// Start logic
window.onload = () => showCard('welcome-screen');

// Input Handling
window.addEventListener('mousedown', (e) => {
    if (!running || isBoosting || e.target.tagName === 'BUTTON') return;
    
    const p = ballPos % PI2;
    const s = targetS % PI2;
    const e_arc = targetE % PI2;
    
    // Check if ball is inside the arc (handles the 0-degree crossing)
    const hit = s < e_arc ? (p >= s && p <= e_arc) : (p >= s || p <= e_arc);

    if (hit && !targetHit) {
        targetHit = true; 
        combo++;
        playSFX('hit');
        score += (combo >= 10 ? 2 : 1);
        vision = Math.min(1.0, vision + 0.15); // Hit gives vision back
        spawnTarget();
    } else {
        combo = 0; 
        vision -= 0.10; // Penalty for missing or clicking empty space
        playSFX('fail');
    }
});
