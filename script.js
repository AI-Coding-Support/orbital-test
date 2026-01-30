// 1. CONFIG & STATE
let CONFIG = { 
    arcMin: 1.2, arcMax: 3.5, baseSpeed: 0.025, 
    visionDecay: 0.0009, streaks: { 10: 2, 20: 3 }
};

let audioCtx, masterGain, bgMusic = document.getElementById('bgMusic');
let score = 0, combo = 0, running = false, vision = 1.0;
let ballPos = 0, lastTime = 0, targetS = 0, targetE = 0, targetHit = true, isBoosting = false;

const canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');
const cx = 300, cy = 300, r = 220, PI2 = Math.PI * 2, OFFSET = -Math.PI/2;

// MOBILE FIX: Scale the canvas to fit the screen
function resize() {
    const size = Math.min(window.innerWidth, window.innerHeight, 600);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
}
window.addEventListener('resize', resize);
resize();

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
        g.gain.setValueAtTime(0.05, now);
        osc.start(); osc.stop(now + 0.1);
    }
}

// 3. UI & RENDER
function showCard(id) {
    document.querySelectorAll('.ui-card').forEach(c => c.style.display = 'none');
    const ui = document.getElementById('ui-layer');
    if (id === 'none') {
        ui.style.opacity = '0'; ui.style.visibility = 'hidden';
    } else {
        ui.style.opacity = '1'; ui.style.visibility = 'visible';
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
    ctx.beginPath(); ctx.arc(bx, by, size, 0, PI2); ctx.fill();
    ctx.shadowBlur = 0;
}

// 4. CORE UPDATE LOOP
function update(t) {
    if (!running) return;
    const dt = Math.min((t - lastTime) / 16.6, 2); 
    lastTime = t;

    ctx.clearRect(0,0,600,600);
    
    // Draw Track
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); ctx.strokeStyle = "#111"; ctx.lineWidth = 30; ctx.stroke();
    
    // Draw Target
    if (!targetHit && !isBoosting) {
        ctx.beginPath(); ctx.strokeStyle = "#00f2ff"; ctx.lineWidth = 35;
        // Fix for drawing arcs that wrap around the 0-point
        if (targetS < targetE) {
            ctx.arc(cx, cy, r, targetS+OFFSET, targetE+OFFSET);
        } else {
            ctx.arc(cx, cy, r, targetS+OFFSET, PI2+OFFSET);
            ctx.stroke(); ctx.beginPath();
            ctx.arc(cx, cy, r, OFFSET, targetE+OFFSET);
        }
        ctx.stroke();
    }

    let currentSpeed = isBoosting ? 0.35 : (CONFIG.baseSpeed + (score * 0.0001));
    
    if (isBoosting) {
        if (Math.random() > 0.8) playSFX('boost_engine');
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

    document.getElementById('vision-bar').style.width = (vision * 100) + '%';
    document.getElementById('score').innerText = Math.floor(score);
    requestAnimationFrame(update);
}

// 5. GAME ACTIONS
window.handleBoost = () => {
    initAudio(); 
    showCard('none');
    score += 100; // FIXED: Flat +100 points
    isBoosting = true; 
    running = true; 
    lastTime = performance.now();
    
    if(bgMusic) {
        bgMusic.currentTime = 0;
        bgMusic.play();
    }
    
    document.getElementById('game-container').classList.add('warping');
    
    setTimeout(() => {
        isBoosting = false;
        document.getElementById('game-container').classList.remove('warping');
        spawnTarget();
    }, 2000);

    requestAnimationFrame(update);
};

function spawnTarget() {
    targetHit = false;
    // VARIABLE TARGETS: Choose between 100%, 70%, or 50% width
    const multipliers = [1.0, 0.7, 0.5];
    const mod = multipliers[Math.floor(Math.random() * multipliers.length)];
    
    let baseWidth = Math.max(0.15, 0.5 - (score * 0.0003));
    let finalWidth = baseWidth * mod;

    let arcDist = CONFIG.arcMin + Math.random() * (CONFIG.arcMax - CONFIG.arcMin);
    targetS = (ballPos + arcDist) % PI2;
    targetE = (targetS + finalWidth) % PI2;
}

function endGame() {
    running = false;
    if(bgMusic) bgMusic.pause();
    playSFX('fail');
    showCard('game-over-card');
    document.getElementById('final-score-display').innerText = Math.floor(score);
}

window.registerPilot = () => { initAudio(); showCard('main-menu'); };

window.startGame = () => { 
    initAudio(); showCard('none'); 
    score = 0; combo = 0; vision = 1.0; 
    running = true; lastTime = performance.now(); 
    spawnTarget(); 
    if(bgMusic) {
        bgMusic.currentTime = 0;
        bgMusic.play();
    }
    requestAnimationFrame(update); 
};

window.onload = () => showCard('welcome-screen');

// TOUCH & MOUSE SUPPORT
const handleInput = (e) => {
    if (!running || isBoosting || (e.target.tagName === 'BUTTON')) return;
    const p = ballPos % PI2;
    const s = targetS % PI2, e_arc = targetE % PI2;
    const hit = s < e_arc ? (p >= s && p <= e_arc) : (p >= s || p <= e_arc);

    if (hit && !targetHit) {
        targetHit = true; combo++;
        playSFX('hit');
        score += (combo >= 10 ? 2 : 1);
        vision = Math.min(1.0, vision + 0.1);
        spawnTarget();
    } else {
        combo = 0; vision -= 0.15;
        playSFX('fail');
    }
    document.getElementById('combo-ui').innerText = `STREAK: ${combo}`;
};

window.addEventListener('mousedown', handleInput);
window.addEventListener('touchstart', (e) => {
    // Prevent zoom/scroll on tap but allow button clicks
    if (e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        handleInput(e);
    }
}, { passive: false });
