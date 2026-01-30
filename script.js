// 1. CONFIG & STATE
let CONFIG = { 
    arcMin: 1.2, 
    arcMax: 3.5, 
    baseSpeed: 0.025, 
    visionDecay: 0.0009, 
    sizes: [1.0, 0.7, 0.5] 
};

let audioCtx, masterGain, bgMusic = document.getElementById('bgMusic');
let score = 0, combo = 0, running = false, vision = 1.0;
let ballPos = 0, lastTime = 0, targetS = 0, targetE = 0, targetHit = true, isBoosting = false;

// Pilot Customization
let pilotName = "GUEST";
let pilotColor = "#00f2ff"; 

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cx = 300, cy = 300, r = 220, PI2 = Math.PI * 2, OFFSET = -Math.PI / 2;

// 2. AUDIO ENGINE
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
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now);
        g.gain.setValueAtTime(0.2, now); g.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(); osc.stop(now + 0.3);
    } else if (type === 'boost_engine') {
        osc.type = 'square'; osc.frequency.setValueAtTime(60 + (Math.random() * 20), now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        g.gain.setValueAtTime(0.05, now); osc.start(); osc.stop(now + 0.1);
    }
}

// 3. UI & SKIN HELPERS
function showCard(id) {
    document.querySelectorAll('.ui-card').forEach(c => c.style.display = 'none');
    const ui = document.getElementById('ui-layer');
    if (id === 'none') { ui.style.display = 'none'; } 
    else { 
        ui.style.display = 'block'; 
        const t = document.getElementById(id); 
        if(t) t.style.display = 'flex'; 
    }
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

window.confirmPilot = () => {
    const input = document.getElementById('username-input').value;
    if (input.trim() !== "") pilotName = input.toUpperCase();
    initAudio();
    showCard('main-menu');
};

// 4. RENDER LOGIC
function drawBall(pos, opacity = 1, size = 15) {
    const bx = cx + Math.cos(pos + OFFSET) * r;
    const by = cy + Math.sin(pos + OFFSET) * r;
    
    // Dynamic coloring based on skin
    ctx.fillStyle = opacity === 1 ? pilotColor : `rgba(${hexToRgb(pilotColor)}, ${opacity})`;
    
    if (opacity > 0.5) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = pilotColor;
    }
    ctx.beginPath(); ctx.arc(bx, by, size, 0, PI2); ctx.fill();
    ctx.shadowBlur = 0;
}

function update(t) {
    if (!running) return;
    const dt = Math.min((t - lastTime) / 16.6, 2); 
    lastTime = t;
    ctx.clearRect(0, 0, 600, 600);
    
    // Orbit Track
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); 
    ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 20; ctx.stroke();
    
    // Target
    if (!targetHit && !isBoosting) {
        ctx.beginPath(); ctx.strokeStyle = pilotColor; ctx.lineWidth = 25;
        ctx.lineCap = "round"; ctx.arc(cx, cy, r, targetS + OFFSET, targetE + OFFSET); 
        ctx.stroke();
    }

    let currentSpeed = isBoosting ? 0.35 : (CONFIG.baseSpeed + (score * 0.0001));
    if (isBoosting) {
        if (Math.random() > 0.8) playSFX('boost_engine');
        for(let i = 1; i <= 8; i++) drawBall(ballPos - (i * 0.08), 1 / (i * 2.5), 12);
    }

    ballPos = (ballPos + currentSpeed * dt) % PI2;
    drawBall(ballPos, 1, 15);
    
    if (!isBoosting) {
        vision -= CONFIG.visionDecay * dt;
        if (vision <= 0) endGame();
    }

    document.getElementById('vision-bar').style.width = (vision * 100) + '%';
    document.getElementById('score').innerText = Math.floor(score);
    document.getElementById('combo-ui').innerText = `STREAK: ${combo}`;
    requestAnimationFrame(update);
}

// 5. GAME ACTIONS
function spawnTarget() {
    targetHit = false;
    let sizeMult = CONFIG.sizes[Math.floor(Math.random() * CONFIG.sizes.length)];
    let baseWidth = Math.max(0.12, (0.5 - (score * 0.0003)) * sizeMult);
    let arcDist = CONFIG.arcMin + Math.random() * (CONFIG.arcMax - CONFIG.arcMin);
    targetS = (ballPos + arcDist) % PI2;
    targetE = (targetS + baseWidth) % PI2;
}

window.handleBoost = () => {
    initAudio(); showCard('none');
    isBoosting = true; running = true; lastTime = performance.now();
    score += 500;
    if(bgMusic) { bgMusic.currentTime = 0; bgMusic.play(); }
    document.getElementById('game-wrapper').classList.add('warping');
    setTimeout(() => {
        isBoosting = false;
        document.getElementById('game-wrapper').classList.remove('warping');
        spawnTarget();
    }, 2000);
    requestAnimationFrame(update);
};

function endGame() {
    running = false; if(bgMusic) bgMusic.pause();
    playSFX('fail'); showCard('game-over-card');
    document.getElementById('final-score-display').innerText = Math.floor(score);
}

window.registerPilot = () => { initAudio(); showCard('main-menu'); };
window.startGame = () => { 
    initAudio(); showCard('none'); 
    score = 0; combo = 0; vision = 1.0; 
    running = true; lastTime = performance.now(); spawnTarget(); 
    if(bgMusic) { bgMusic.currentTime = 0; bgMusic.play(); }
    requestAnimationFrame(update); 
};

// 6. INITIALIZATION & LISTENERS
window.onload = () => {
    showCard('login-screen');
    
    // Setup Skin Selector
    document.querySelectorAll('.skin-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.skin-opt').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            pilotColor = opt.dataset.color;
        });
    });
};

window.addEventListener('mousedown', (e) => {
    if (!running || isBoosting || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    const p = ballPos % PI2, s = targetS % PI2, e_arc = targetE % PI2;
    const hit = s < e_arc ? (p >= s && p <= e_arc) : (p >= s || p <= e_arc);
    if (hit && !targetHit) {
        targetHit = true; combo++; playSFX('hit');
        score += (combo >= 10 ? 2 : 1);
        vision = Math.min(1.0, vision + 0.15); spawnTarget();
    } else { combo = 0; vision -= 0.10; playSFX('fail'); }
});
