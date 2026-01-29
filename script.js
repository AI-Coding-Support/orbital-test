// 1. CONFIGURATION
let CONFIG = { 
    arcMin: 1.2, arcMax: 3.5, baseSpeed: 0.025, 
    visionDecay: 0.0009, streaks: { 10: 2, 20: 3 }
};

// 2. STATE REPAIR
let audioCtx, masterGain, bgMusic = document.getElementById('bgMusic');
let score = 0, combo = 0, running = false, vision = 1.0;
let ballPos = 0, lastTime = 0, targetS = 0, targetE = 0, targetHit = true, isBoosting = false;

const canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');
const cx = 300, cy = 300, r = 220, PI2 = Math.PI * 2, OFFSET = -Math.PI/2;

// 3. AUDIO ENGINE (FIXED)
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.3; masterGain.connect(audioCtx.destination);
    }
}

function playSFX(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g); g.connect(masterGain);
    const now = audioCtx.currentTime;

    if (type === 'hit') {
        osc.frequency.setValueAtTime(400 + (combo * 10), now);
        osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
        g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
    } else if (type === 'boost') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        g.gain.setValueAtTime(0.1, now);
        osc.start(); osc.stop(now + 0.1);
    }
}

// 4. UI CONTROL (RE-ESTABLISHED)
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

// 5. THE "VISIBLE ROLL" RENDERER
function drawBall(pos, opacity = 1, size = 15) {
    const bx = cx + Math.cos(pos + OFFSET) * r;
    const by = cy + Math.sin(pos + OFFSET) * r;
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.shadowBlur = opacity > 0.5 ? 15 : 0;
    ctx.shadowColor = "#00f2ff";
    ctx.beginPath(); ctx.arc(bx, by, size, 0, PI2); ctx.fill();
    ctx.shadowBlur = 0;
}

function update(t) {
    if (!running) return;
    const dt = Math.min((t - lastTime) / 16.6, 2); 
    lastTime = t;

    ctx.clearRect(0,0,600,600);
    
    // Draw Track
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); ctx.strokeStyle = "#111"; ctx.lineWidth = 30; ctx.stroke();
    
    // Draw Target
    if (!targetHit) {
        ctx.beginPath(); ctx.strokeStyle = "#00f2ff"; ctx.lineWidth = 35;
        ctx.arc(cx, cy, r, targetS+OFFSET, targetE+OFFSET); ctx.stroke();
    }

    // MOTION LOGIC
    let currentSpeed = isBoosting ? 0.3 : (CONFIG.baseSpeed + (score * 0.0001));
    
    if (isBoosting) {
        // Draw motion trail
        for(let i = 1; i <= 5; i++) {
            drawBall(ballPos - (i * 0.05), 1 / (i * 2), 12);
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

// 6. POWER-UP & GAME FLOW
window.handleBoost = () => {
    initAudio(); showCard('none');
    isBoosting = true; running = true; lastTime = performance.now();
    document.getElementById('game-container').classList.add('warping');
    
    let boostTime = 0;
    const boostLoop = () => {
        boostTime++;
        score += 1.5;
        if (boostTime % 4 === 0) playSFX('boost');
        if (boostTime < 100) {
            // we use the main update loop via the isBoosting flag
        } else {
            isBoosting = false;
            document.getElementById('game-container').classList.remove('warping');
            spawnTarget();
        }
    };
    
    // The main loop handles the drawing, we just time the exit
    setTimeout(() => {
        isBoosting = false;
        document.getElementById('game-container').classList.remove('warping');
        spawnTarget();
        if(bgMusic) bgMusic.play();
    }, 2000);

    requestAnimationFrame(update);
};

function spawnTarget() {
    targetHit = false;
    let baseWidth = Math.max(0.15, 0.5 - (score * 0.0003));
    let arcDist = CONFIG.arcMin + Math.random() * (CONFIG.arcMax - CONFIG.arcMin);
    targetS = (ballPos + arcDist) % PI2;
    targetE = (targetS + baseWidth) % PI2;
}

function endGame() {
    running = false;
    showCard('game-over-card');
    document.getElementById('final-score-display').innerText = Math.floor(score);
}

window.registerPilot = () => { initAudio(); showCard('main-menu'); };
window.startGame = () => { 
    initAudio(); showCard('none'); 
    score = 0; combo = 0; vision = 1.0; 
    running = true; lastTime = performance.now(); 
    spawnTarget(); requestAnimationFrame(update); 
    if(bgMusic) bgMusic.play(); 
};

window.onload = () => showCard('welcome-screen');

window.addEventListener('mousedown', (e) => {
    if (!running || isBoosting || e.target.tagName === 'BUTTON') return;
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
    }
    document.getElementById('combo-ui').innerText = `STREAK: ${combo}`;
});
