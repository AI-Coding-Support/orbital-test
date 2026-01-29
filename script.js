let CONFIG = { 
    arcMin: 1.2, arcMax: 3.5, baseSpeed: 0.025, 
    visionDecay: 0.0009, streaks: { 10: 2, 20: 3 }
};

let audioCtx, masterGain, bgMusic = document.getElementById('bgMusic');

// --- VERCEL BACKEND SYNC ---
async function syncBackend() {
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            Object.assign(CONFIG, data);
            console.log("Synced with Vercel Dashboard:", CONFIG);
        }
    } catch (e) { console.log("Using Local Config"); }
}

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
    } else if (type === 'fail') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(20, now + 0.4);
        g.gain.setValueAtTime(0.3, now); g.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.start(); osc.stop(now + 0.4);
    } else if (type === 'boost') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
        g.gain.setValueAtTime(0.1, now);
        osc.start(); osc.stop(now + 0.05);
    }
}

const canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');
const cx = 300, cy = 300, r = 220, PI2 = Math.PI * 2, OFFSET = -Math.PI/2;

let score = 0, combo = 0, running = false, vision = 1.0;
let ballPos = 0, lastTime = 0, targetS = 0, targetE = 0, targetHit = true, isBoosting = false;

function showCard(id) {
    const screens = ['welcome-screen', 'main-menu', 'game-over-card'];
    screens.forEach(s => {
        const el = document.getElementById(s);
        if(el) el.style.display = 'none';
    });
    
    const ui = document.getElementById('ui-layer');
    if (id === 'none') {
        ui.style.opacity = '0';
        ui.style.pointerEvents = 'none'; // This lets you click "through" the blur
        setTimeout(() => { ui.style.visibility = 'hidden'; }, 400);
    } else {
        ui.style.visibility = 'visible';
        ui.style.opacity = '1';
        ui.style.pointerEvents = 'auto';
        const target = document.getElementById(id);
        if(target) target.style.display = 'flex';
    }
}

function spawnTarget() {
    targetHit = false;
    const scales = [1.0, 0.75, 0.5];
    const sVar = scales[Math.floor(Math.random() * scales.length)];
    let baseWidth = Math.max(0.12, 0.5 - (score * 0.0004));
    let finalWidth = baseWidth * sVar;
    let arcDist = CONFIG.arcMin + Math.random() * (CONFIG.arcMax - CONFIG.arcMin);
    targetS = (ballPos + arcDist) % PI2;
    targetE = (targetS + finalWidth) % PI2;
}

function handleInput() {
    if (!running || isBoosting) return;
    initAudio();
    const p = ballPos % PI2;
    const s = targetS % PI2, e = targetE % PI2;
    const hit = s < e ? (p >= s && p <= e) : (p >= s || p <= e);

    if (hit && !targetHit) {
        targetHit = true; combo++;
        playSFX('hit');
        score += (combo >= 20) ? CONFIG.streaks[20] : (combo >= 10 ? CONFIG.streaks[10] : 1);
        vision = Math.min(1.0, vision + 0.1);
        spawnTarget();
    } else {
        combo = 0; vision -= 0.15;
        playSFX('fail');
    }
    document.getElementById('combo-ui').innerText = `STREAK: ${combo}`;
}

window.handleBoost = () => {
    initAudio(); showCard('none');
    isBoosting = true; running = true; lastTime = performance.now();
    document.getElementById('game-container').classList.add('warping');
    let f = 0;
    const runB = (t) => {
        if (!isBoosting) return;
        const dt = (t - lastTime) / 16.6; lastTime = t;
        ballPos += 0.4 * dt; score += 1; f++;
        if (f % 5 === 0) playSFX('boost');
        ctx.clearRect(0,0,600,600);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); ctx.strokeStyle = "#00f2ff"; ctx.lineWidth = 40; ctx.stroke();
        document.getElementById('score').innerText = score;
        if (f < 100) requestAnimationFrame(runB);
        else {
            isBoosting = false; document.getElementById('game-container').classList.remove('warping');
            spawnTarget(); requestAnimationFrame(update); bgMusic.play();
        }
    };
    requestAnimationFrame(runB);
};

function update(t) {
    if (!running || isBoosting) return;
    const dt = (t - lastTime) / 16.6; lastTime = t;
    ctx.clearRect(0,0,600,600);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); ctx.strokeStyle = "#111"; ctx.lineWidth = 30; ctx.stroke();
    if (!targetHit) {
        ctx.beginPath(); ctx.strokeStyle = "#00f2ff"; ctx.arc(cx, cy, r, targetS+OFFSET, targetE+OFFSET); ctx.stroke();
    }
    ballPos = (ballPos + (CONFIG.baseSpeed + (score * 0.00012)) * dt) % PI2;
    const bx = cx + Math.cos(ballPos + OFFSET) * r, by = cy + Math.sin(ballPos + OFFSET) * r;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bx, by, 15, 0, PI2); ctx.fill();
    vision -= CONFIG.visionDecay * dt;
    document.getElementById('vision-bar').style.width = (vision * 100) + '%';
    document.getElementById('score').innerText = score;
    if (vision <= 0) endGame(); else requestAnimationFrame(update);
}

function endGame() {
    running = false; playSFX('fail');
    bgMusic.pause(); bgMusic.currentTime = 0;
    showCard('game-over-card');
    document.getElementById('final-score-display').innerText = score;
}

window.registerPilot = () => { initAudio(); showCard('main-menu'); };
window.startGame = () => { initAudio(); showCard('none'); score = 0; combo = 0; vision = 1.0; running = true; lastTime = performance.now(); spawnTarget(); requestAnimationFrame(update); bgMusic.play(); };

window.onload = () => {
    showCard('welcome-screen');
    syncBackend();
};
window.addEventListener('mousedown', (e) => { if(e.target.tagName !== 'BUTTON') handleInput(); });

