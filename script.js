// 1. CONFIG & STATE
// These defaults are used only if the server can't be reached.
let CONFIG = { 
    arcMin: 1.2, arcMax: 3.5, baseSpeed: 0.025, 
    visionDecay: 0.0009, sizes: [1.0, 0.7, 0.5] 
};

let audioCtx, masterGain, bgMusic = document.getElementById('bgMusic');
let score = 0, combo = 0, running = false, vision = 1.0;
let ballPos = 0, lastTime = 0, targetS = 0, targetE = 0, targetHit = true, isBoosting = false;
let pilotName = "GUEST", pilotColor = "#00f2ff";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cx = 300, cy = 300, r = 220, PI2 = Math.PI * 2, OFFSET = -Math.PI / 2;

// 2. INITIALIZATION & SERVER SYNC
window.onload = async () => {
    showCard('login-screen');
    const err = document.getElementById('login-error');
    err.innerText = "ESTABLISHING EDGE CONNECTION...";

    try {
        // Fetch global difficulty from our Redis-backed API
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Offline');
        
        const remoteConfig = await response.json();
        CONFIG = { ...CONFIG, ...remoteConfig }; 
        
        err.style.color = "#00f2ff";
        err.innerText = "SYSTEMS SYNCHRONIZED";
    } catch (e) {
        err.style.color = "#ffcc00";
        err.innerText = "OFFLINE MODE: LOCAL CORE ACTIVE";
    }

    setupSkinListeners();
};

// 3. USERNAME MODERATION
async function moderateUsername(name) {
    const forbidden = ['admin', 'root', 'system', 'mod', 'server', 'god']; 
    // This simulates a call to an industry moderation API
    return new Promise((resolve) => {
        setTimeout(() => {
            const isClean = !forbidden.includes(name.toLowerCase()) && /^[a-zA-Z0-9_]{3,12}$/.test(name);
            resolve(isClean);
        }, 400);
    });
}

window.validateInput = async () => {
    const input = document.getElementById('username-input');
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');
    const val = input.value.trim();

    if (val.length < 3) {
        btn.disabled = true;
        err.innerText = "";
        return;
    }

    err.style.color = "#aaa";
    err.innerText = "VETTING CALLSIGN...";

    const isSafe = await moderateUsername(val);

    if (!isSafe) {
        err.style.color = "#ff4444";
        err.innerText = "CALLSIGN REJECTED BY SECURITY";
        input.classList.add('invalid');
        btn.disabled = true;
    } else {
        err.style.color = "#00f2ff";
        err.innerText = "CALLSIGN APPROVED";
        input.classList.remove('invalid');
        btn.disabled = false;
    }
};

// 4. SECURE ADMIN SYSTEM
// Hidden Shortcut: SHIFT + ALT + A
window.addEventListener('keydown', (e) => {
    const menuVisible = document.getElementById('main-menu').style.display === 'flex';
    if (e.key.toLowerCase() === 'a' && e.shiftKey && e.altKey && menuVisible) {
        showAdmin();
    }
});

function showAdmin() {
    document.getElementById('cfg-speed').value = CONFIG.baseSpeed;
    document.getElementById('cfg-decay').value = CONFIG.visionDecay;
    document.getElementById('cfg-arcMin').value = CONFIG.arcMin;
    document.getElementById('cfg-arcMax').value = CONFIG.arcMax;
    showCard('admin-dashboard');
}

window.saveAdminConfig = async () => {
    const password = prompt("ENTER SYSTEM OVERRIDE KEY:");
    if (!password) return;

    const newConfig = {
        baseSpeed: parseFloat(document.getElementById('cfg-speed').value),
        visionDecay: parseFloat(document.getElementById('cfg-decay').value),
        arcMin: parseFloat(document.getElementById('cfg-arcMin').value),
        arcMax: parseFloat(document.getElementById('cfg-arcMax').value)
    };

    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth: password, newConfig })
        });

        const result = await response.json();

        if (response.ok) {
            CONFIG = newConfig; // Only update local state if server confirms password
            alert("GLOBAL UPDATE SUCCESSFUL");
            showCard('main-menu');
        } else {
            alert(`ACCESS DENIED: ${result.error || 'UNAUTHORIZED'}`);
            showAdmin(); // Reset form
        }
    } catch (err) {
        alert("COMMUNICATIONS ERROR: FAILED TO REACH REDIS");
    }
};

// 5. GAME ENGINE
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.4;
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
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
    } else if (type === 'ui_click') {
        osc.frequency.setValueAtTime(800, now);
        g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(); osc.stop(now + 0.05);
    }
}

function showCard(id) {
    document.querySelectorAll('.ui-card').forEach(c => c.style.display = 'none');
    const ui = document.getElementById('ui-layer');
    ui.style.display = 'block'; 
    const target = document.getElementById(id);
    if (target) target.style.display = 'flex';
    if (id === 'none') ui.style.display = 'none';
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

function drawBall(pos, opacity = 1, size = 15) {
    const bx = cx + Math.cos(pos + OFFSET) * r, by = cy + Math.sin(pos + OFFSET) * r;
    ctx.fillStyle = opacity === 1 ? pilotColor : `rgba(${hexToRgb(pilotColor)}, ${opacity})`;
    if (opacity > 0.5) { ctx.shadowBlur = 15; ctx.shadowColor = pilotColor; }
    ctx.beginPath(); ctx.arc(bx, by, size, 0, PI2); ctx.fill();
    ctx.shadowBlur = 0;
}

function update(t) {
    if (!running) return;
    const dt = Math.min((t - lastTime) / 16.6, 2); 
    lastTime = t;
    ctx.clearRect(0, 0, 600, 600);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); 
    ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 20; ctx.stroke();
    
    if (!targetHit && !isBoosting) {
        ctx.beginPath(); ctx.strokeStyle = pilotColor; ctx.lineWidth = 25;
        ctx.lineCap = "round"; ctx.arc(cx, cy, r, targetS + OFFSET, targetE + OFFSET); ctx.stroke();
    }
    
    let currentSpeed = isBoosting ? 0.35 : (CONFIG.baseSpeed + (score * 0.0001));
    if (isBoosting) { for(let i = 1; i <= 8; i++) drawBall(ballPos - (i * 0.08), 1 / (i * 2.5), 12); }

    ballPos = (ballPos + currentSpeed * dt) % PI2;
    drawBall(ballPos, 1, 15);
    if (!isBoosting) { vision -= CONFIG.visionDecay * dt; if (vision <= 0) endGame(); }
    
    document.getElementById('vision-bar').style.width = (vision * 100) + '%';
    document.getElementById('score').innerText = Math.floor(score);
    document.getElementById('combo-ui').innerText = `STREAK: ${combo}`;
    requestAnimationFrame(update);
}

// 6. ACTIONS & PROMO
function checkPromo() {
    const params = new URLSearchParams(window.location.search);
    const promoArea = document.getElementById('promo-area');
    if (params.get('promo') === 'boost500' && promoArea.innerHTML === "") {
        const promoBtn = document.createElement('button');
        promoBtn.innerHTML = "PROMO: BOOST DEPLOY (+500)";
        promoBtn.style.cssText = "border-color: #ffcc00; color: #ffcc00; margin-top: 15px;";
        promoBtn.onclick = handleBoost;
        promoArea.appendChild(promoBtn);
        document.getElementById('promo-status').innerText = "PROMOTIONAL LINK VERIFIED";
        document.getElementById('promo-status').style.color = "#ffcc00";
    }
}

function spawnTarget() {
    targetHit = false;
    let sizeMult = CONFIG.sizes[Math.floor(Math.random() * CONFIG.sizes.length)];
    let baseWidth = Math.max(0.12, (0.5 - (score * 0.0003)) * sizeMult);
    let arcDist = CONFIG.arcMin + Math.random() * (CONFIG.arcMax - CONFIG.arcMin);
    targetS = (ballPos + arcDist) % PI2; targetE = (targetS + baseWidth) % PI2;
}

window.confirmPilot = () => {
    initAudio(); playSFX('ui_click');
    pilotName = document.getElementById('username-input').value.toUpperCase();
    showCard('main-menu');
    checkPromo();
};

window.handleBoost = () => {
    showCard('none'); isBoosting = true; running = true; score += 500;
    if(bgMusic) { bgMusic.currentTime = 0; bgMusic.play(); }
    document.getElementById('game-wrapper').classList.add('warping');
    setTimeout(() => { isBoosting = false; document.getElementById('game-wrapper').classList.remove('warping'); spawnTarget(); }, 2000);
    requestAnimationFrame(update);
};

function endGame() {
    running = false; if(bgMusic) bgMusic.pause();
    playSFX('fail');
    document.getElementById('end-pilot-name').innerText = pilotName;
    document.getElementById('end-pilot-name').style.color = pilotColor;
    document.getElementById('final-score-display').innerText = Math.floor(score);
    showCard('game-over-card');
}

window.startGame = () => { 
    initAudio(); playSFX('ui_click'); showCard('none'); 
    score = 0; combo = 0; vision = 1.0; running = true; 
    lastTime = performance.now(); spawnTarget(); 
    if(bgMusic) { bgMusic.currentTime = 0; bgMusic.play(); }
    requestAnimationFrame(update); 
};

function setupSkinListeners() {
    document.querySelectorAll('.skin-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            initAudio(); playSFX('ui_click');
            document.querySelectorAll('.skin-opt').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            pilotColor = opt.dataset.color;
            document.documentElement.style.setProperty('--pilot-color', pilotColor);
        });
    });
}

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
