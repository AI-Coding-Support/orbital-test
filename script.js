// 1. CONFIG & STATE
let CONFIG = { 
    arcMin: 1.2, arcMax: 3.5, baseSpeed: 0.025, 
    visionDecay: 0.0009, streaks: { 10: 2, 20: 3 }
};

let audioCtx, masterGain, bgMusic = document.getElementById('bgMusic');
let score = 0, combo = 0, running = false, vision = 1.0;
let ballPos = 0, lastTime = 0, targetS = 0, targetE = 0, targetHit = true, isBoosting = false;
let activePowerUp = null; // {pos, type}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const cx = 300, cy = 300, r = 220, PI2 = Math.PI * 2, OFFSET = -Math.PI/2;

// 2. AUDIO ENGINE
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.4;
        masterGain.connect(audioCtx.destination);
        if (bgMusic) bgMusic.volume = 0.15;
    }
}

function playSFX(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g); g.connect(masterGain);
    const now = audioCtx.currentTime;

    if (type === 'hit') {
        osc.frequency.setValueAtTime(500 + (combo * 20), now);
        g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
    } else if (type === 'powerup') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(1500, now + 0.2);
        g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(); osc.stop(now + 0.2);
    }
}

// 3. TARGET & POWER-UP SPAWNING
function spawnTarget() {
    targetHit = false;
    const mods = [1.0, 0.7, 0.5];
    const chosenMod = mods[Math.floor(Math.random() * mods.length)];
    let baseWidth = Math.max(0.15, 0.5 - (score * 0.0002));
    let finalWidth = baseWidth * chosenMod;

    let arcDist = CONFIG.arcMin + (Math.random() * (CONFIG.arcMax - CONFIG.arcMin));
    targetS = (ballPos + arcDist) % PI2;
    targetE = (targetS + finalWidth) % PI2;

    // Spawn Power-up (25% chance)
    if (Math.random() < 0.25 && !activePowerUp) {
        activePowerUp = {
            pos: (targetE + 0.8) % PI2,
            type: Math.random() > 0.5 ? 'BOOST' : 'VISION'
        };
    }
}

// 4. RENDERING & PHYSICS
function drawBall(pos, opacity = 1, size = 15) {
    const bx = cx + Math.cos(pos + OFFSET) * r;
    const by = cy + Math.sin(pos + OFFSET) * r;
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    if (opacity > 0.8) { ctx.shadowBlur = 15; ctx.shadowColor = "#00f2ff"; }
    ctx.beginPath(); ctx.arc(bx, by, size, 0, PI2); ctx.fill();
    ctx.shadowBlur = 0;
}

function update(t) {
    if (!running || !ctx) return;
    const dt = Math.min((t - lastTime) / 16.6, 2); 
    lastTime = t;
    ctx.clearRect(0,0,600,600);
    
    // Draw Track
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); ctx.strokeStyle = "#111"; ctx.lineWidth = 30; ctx.stroke();
    
    // Draw Target
    if (!targetHit && !isBoosting) {
        ctx.beginPath(); ctx.strokeStyle = "#00f2ff"; ctx.lineWidth = 35; ctx.lineCap = 'round';
        if (targetS < targetE) ctx.arc(cx, cy, r, targetS + OFFSET, targetE + OFFSET);
        else { ctx.arc(cx, cy, r, targetS + OFFSET, PI2 + OFFSET); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r, OFFSET, targetE + OFFSET); }
        ctx.stroke();
    }

    // Draw Power-Up
    if (activePowerUp) {
        const px = cx + Math.cos(activePowerUp.pos + OFFSET) * r;
        const py = cy + Math.sin(activePowerUp.pos + OFFSET) * r;
        ctx.fillStyle = activePowerUp.type === 'BOOST' ? "#ffcc00" : "#00ff88";
        ctx.beginPath(); ctx.arc(px, py, 10, 0, PI2); ctx.fill();

        // Collision Check
        let diff = Math.abs(ballPos - activePowerUp.pos);
        if (diff < 0.1 || diff > PI2 - 0.1) {
            if (activePowerUp.type === 'BOOST') {
                score += 100;
                isBoosting = true;
                document.getElementById('game-container').classList.add('warping');
                setTimeout(() => {
                    isBoosting = false;
                    document.getElementById('game-container').classList.remove('warping');
                }, 1500);
            } else {
                vision = 1.0;
            }
            playSFX('powerup');
            activePowerUp = null;
        }
    }

    let currentSpeed = isBoosting ? 0.38 : (CONFIG.baseSpeed + (score * 0.0001));
    if (isBoosting) {
        for(let i = 1; i <= 8; i++) drawBall(ballPos - (i * 0.08), 1 / (i * 2), 12);
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

// 5. UI & FLOW
function showCard(id) {
    document.querySelectorAll('.ui-card').forEach(c => c.style.display = 'none');
    const ui = document.getElementById('ui-layer');
    if (!ui) return;
    if (id === 'none') {
        ui.style.opacity = '0'; ui.style.visibility = 'hidden';
    } else {
        ui.style.opacity = '1'; ui.style.visibility = 'visible';
        const target = document.getElementById(id);
        if (target) target.style.display = 'flex';
    }
}

window.handleBoost = () => {
    initAudio(); showCard('none');
    score += 100;
    isBoosting = true; running = true; lastTime = performance.now();
    if(bgMusic) bgMusic.play();
    document.getElementById('game-container').classList.add('warping');
    setTimeout(() => {
        isBoosting = false;
        document.getElementById('game-container').classList.remove('warping');
        spawnTarget();
    }, 2000);
    requestAnimationFrame(update);
};

window.startGame = () => {
    initAudio(); showCard('none');
    score = 0; combo = 0; vision = 1.0; activePowerUp = null;
    running = true; lastTime = performance.now();
    if(bgMusic) bgMusic.play();
    spawnTarget();
    requestAnimationFrame(update);
};

function endGame() {
    running = false;
    if(bgMusic) bgMusic.pause();
    showCard('game-over-card');
}

window.registerPilot = () => { initAudio(); showCard('main-menu'); };
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
        vision = Math.min(1.0, vision + 0.12);
        spawnTarget();
    } else {
        combo = 0; vision -= 0.15;
    }
    document.getElementById('combo-ui').innerText = `STREAK: ${combo}`;
});
