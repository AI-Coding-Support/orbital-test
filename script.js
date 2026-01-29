// --- CONFIG & STATE ---
let CONFIG = { 
    arcMin: 1.2, arcMax: 3.5, baseSpeed: 0.025, 
    visionDecay: 0.0009, streaks: { 10: 2, 20: 3 }
};
let audioCtx, masterGain, bgMusic = document.getElementById('bgMusic');
let score = 0, combo = 0, running = false, vision = 1.0;
let ballPos = 0, lastTime = 0, targetS = 0, targetE = 0, targetHit = true, isBoosting = false;

// --- PRO AUDIO ENGINE ---
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.3; masterGain.connect(audioCtx.destination);
    }
}

function playSFX(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g); g.connect(masterGain);

    if (type === 'boost') {
        // Multi-oscillator "Engine Rev" sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(40, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        g.gain.setValueAtTime(0.2, now);
        g.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
    } else if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500 + (combo * 15), now);
        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(); osc.stop(now + 0.15);
    }
}

// --- RENDERING & MOTION ---
const canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');
const cx = 300, cy = 300, r = 220, PI2 = Math.PI * 2, OFFSET = -Math.PI/2;

function drawBall(alpha = 1) {
    const bx = cx + Math.cos(ballPos + OFFSET) * r;
    const by = cy + Math.sin(ballPos + OFFSET) * r;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath(); ctx.arc(bx, by, 15, 0, PI2); ctx.fill();
    // Inner Glow
    ctx.shadowBlur = 15; ctx.shadowColor = "#00f2ff";
}

function update(t) {
    if (!running) return;
    const dt = Math.min((t - lastTime) / 16.6, 2); 
    lastTime = t;

    ctx.clearRect(0, 0, 600, 600);
    ctx.shadowBlur = 0; // Reset shadow for track

    // 1. Draw Static Track
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); ctx.strokeStyle = "#111"; ctx.lineWidth = 30; ctx.stroke();

    // 2. Draw Target
    if (!targetHit) {
        ctx.beginPath(); ctx.strokeStyle = "#00f2ff"; ctx.lineWidth = 35;
        ctx.arc(cx, cy, r, targetS + OFFSET, targetE + OFFSET); ctx.stroke();
    }

    // 3. MOTION SUB-STEPPING (Fixes the "Flashing/Teleporting" look)
    let steps = isBoosting ? 10 : 1; 
    let stepMove = ((CONFIG.baseSpeed + (score * 0.0001)) * dt) / steps;
    if (isBoosting) stepMove = (0.4 * dt) / steps;

    for (let i = 0; i < steps; i++) {
        ballPos = (ballPos + stepMove) % PI2;
        if (isBoosting) drawBall(0.2); // Draw motion blur trail during boost
    }
    
    drawBall(1); // Final solid ball

    // 4. VISION & HUD
    if (!isBoosting) {
        vision -= CONFIG.visionDecay * dt;
        if (vision <= 0) endGame();
    }
    
    document.getElementById('vision-bar').style.width = (vision * 100) + '%';
    document.getElementById('score').innerText = Math.floor(score);
    requestAnimationFrame(update);
}

// --- BOOST LOGIC (The Power-up) ---
window.handleBoost = () => {
    initAudio(); 
    showCard('none');
    score += 100;
    isBoosting = true;
    running = true;
    lastTime = performance.now();
    
    document.getElementById('game-container').classList.add('warping');
    
    // Play sequence of boost sounds
    let boostInterval = setInterval(() => {
        if (!isBoosting) clearInterval(boostInterval);
        playSFX('boost');
    }, 100);

    setTimeout(() => {
        isBoosting = false;
        document.getElementById('game-container').classList.remove('warping');
        spawnTarget();
        bgMusic.play();
    }, 2000); // 2 seconds of high-speed rolling
};

// --- SPAWN LOGIC ---
function spawnTarget() {
    targetHit = false;
    let baseWidth = Math.max(0.15, 0.5 - (score * 0.0003));
    let arcDist = CONFIG.arcMin + Math.random() * (CONFIG.arcMax - CONFIG.arcMin);
    targetS = (ballPos + arcDist) % PI2;
    targetE = (targetS + baseWidth) % PI2;
}
