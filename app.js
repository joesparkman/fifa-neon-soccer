const API_BASE = "https://4u8txpe5jh.execute-api.us-east-1.amazonaws.com/Prod";
const CV = document.getElementById("c");
const G = CV.getContext("2d");

// Canvas is portrait: 390 x 700 logical pixels
CV.width = 390;
CV.height = 700;
const W = 390, H = 700;



// DOM refs
const readyEl   = document.getElementById("ready-screen");
const gameoverEl = document.getElementById("gameover-screen");
const goWho     = document.getElementById("go-who");
const goFinal   = document.getElementById("go-final");
const goWinsEl  = document.getElementById("go-wins");
document.getElementById("btn-again").onclick = startGame;
readyEl.addEventListener("click", () => { if (state === "title") startGame(); });
CV.addEventListener("click", () => { if (state === "title") startGame(); });

const DOM = {
  scoreP:    document.getElementById("score-p"),
  scoreCPU:  document.getElementById("score-cpu"),
  pStreak:   document.getElementById("stat-p-streak"),
  pSpeed:    document.getElementById("stat-p-speed"),
  pPower:    document.getElementById("stat-p-power"),
  cpuStreak: document.getElementById("stat-cpu-streak"),
  cpuSpeed:  document.getElementById("stat-cpu-speed"),
  cpuPower:  document.getElementById("stat-cpu-power"),
};

// ── Audio ──
let audioCtx = null, muted = true;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function mkNoise(ctx, dur) {
  const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b; return s;
}
function playSound(type, speed = 1) {
  if (muted) return;
  const ctx = getAudio(), t = ctx.currentTime, out = ctx.destination;
  if (type === "hit") {
    const n = mkNoise(ctx, 0.07), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = "bandpass"; bp.frequency.value = 900 + speed * 180 + Math.random() * 400; bp.Q.value = 2 + Math.random() * 3;
    g.gain.setValueAtTime(0.5 + Math.min(speed / 18, 0.35), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.07);
  }
  if (type === "wall") {
    const n = mkNoise(ctx, 0.04), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = "highpass"; hp.frequency.value = 1400 + Math.random() * 600;
    g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    n.connect(hp); hp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.04);
  }
  if (type === "goal") {
    const sub = ctx.createOscillator(), sg = ctx.createGain();
    sub.type = "sine"; sub.frequency.setValueAtTime(60, t); sub.frequency.exponentialRampToValueAtTime(28, t + 0.25);
    sg.gain.setValueAtTime(0.6, t); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    sub.connect(sg); sg.connect(out); sub.start(t); sub.stop(t + 0.3);
    [[0,"sawtooth",233],[0.01,"sawtooth",220],[0.02,"sawtooth",246]].forEach(([dt, wv, f]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = wv; o.frequency.value = f;
      g.gain.setValueAtTime(0.15, t + dt); g.gain.setValueAtTime(0.15, t + 0.5); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(g); g.connect(out); o.start(t + dt); o.stop(t + 0.71);
    });
  }
  if (type === "victory") {
    [[0,392,0.12],[0.13,392,0.12],[0.26,392,0.12],[0.39,523,0.45],[0.58,494,0.18],[0.77,440,0.18],[0.96,523,0.6]].forEach(([dt,f,dur]) => {
      [-4,0,4].forEach(cents => {
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = "sawtooth"; o.frequency.value = f * Math.pow(2, cents / 1200);
        lp.type = "lowpass"; lp.frequency.value = 1800;
        g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(0.08, t + dt + 0.02);
        g.gain.setValueAtTime(0.08, t + dt + dur - 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + dt + dur);
        o.connect(lp); lp.connect(g); g.connect(out); o.start(t + dt); o.stop(t + dt + dur + 0.01);
      });
    });
  }
}

const muteBtn = document.getElementById("mute-btn");
function updateMuteLabel() { muteBtn.innerHTML = muted ? "PRESS S FOR SOUND" : "PRESS S TO MUTE"; }
updateMuteLabel();
function toggleMute() {
  muted = !muted;
  if (!muted) getAudio().resume();
  updateMuteLabel();
}

// ── Confetti ──
const confetti = [];
const CONF_COLORS = ["#00d4ff","#ff2d55","#ffc940","#ffffff","#a855f7","#22c55e","#fb923c"];
function spawnConfetti() {
  for (let i = 0; i < 160; i++) confetti.push({ x: Math.random() * W, y: -10 - Math.random() * 120, vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 4, rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.22, w: 6 + Math.random() * 8, h: 3 + Math.random() * 4, col: CONF_COLORS[Math.floor(Math.random() * CONF_COLORS.length)], life: 1 });
}
function updateConfetti() {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const c = confetti[i]; c.x += c.vx; c.y += c.vy; c.vy += 0.08; c.vx *= 0.99; c.rot += c.rotV;
    if (c.y > H + 20) c.life -= 0.05;
    if (c.life <= 0) confetti.splice(i, 1);
  }
}
function drawConfetti() {
  confetti.forEach(c => { G.save(); G.globalAlpha = c.life; G.translate(c.x, c.y); G.rotate(c.rot); G.fillStyle = c.col; G.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); G.restore(); });
}

// ── Field dimensions ──
// Portrait soccer pitch: goals on top/bottom
const FX = 15, FY = 15, FW = W - 30, FH = H - 30;
const CX = W / 2, CY = H / 2;
const GOAL_W = 100, GOAL_DEPTH = 18;
const GOAL_X1 = CX - GOAL_W / 2, GOAL_X2 = CX + GOAL_W / 2;
const BALL_R = 13, PLAYER_R = 22;
const FRICTION = 0.993, WALL_BOUNCE = 0.80;
const MAX_SCORE = 7;

// CPU AI tuning
const CPU_SPEED = 4.2, CPU_REACT = 0.60, CPU_ERROR_X = 28, CPU_MISTAKE_CHANCE = 0.016, CPU_MISTAKE_DUR = 40;

// ── State ──
let state = "title", tick = 0;
let shakeX = 0, shakeY = 0, shakeAmt = 0;
let goalFlash = 0, goalWho = "", goalMsgScale = 0;
let ballSpeedMult = 1.0, lastSpeedUpAt = 0, speedUpMsg = "", speedUpTimer = 0;
let sloMo = false, sloMoAlpha = 0, sloMoIntro = 0, sloMoLabelTimer = 0;
let confettiInterval = null;

const stats = {
  p:   { goals: 0, streak: 0, bestStreak: 0, topSpeed: 0, powerKicks: 0 },
  cpu: { goals: 0, streak: 0, bestStreak: 0, topSpeed: 0, powerKicks: 0 },
};
function resetStats() {
  stats.p   = { goals: 0, streak: 0, bestStreak: 0, topSpeed: 0, powerKicks: 0 };
  stats.cpu = { goals: 0, streak: 0, bestStreak: 0, topSpeed: 0, powerKicks: 0 };
}

const score = { p: 0, cpu: 0 };

// Ball
const ball = { x: CX, y: CY, vx: 0, vy: 0, r: BALL_R };
const trail = [];

// Player (bottom half) — controlled by touch/mouse
const player = { x: CX, y: FY + FH - 120, tx: CX, ty: FY + FH - 120, r: PLAYER_R, pvx: 0, pvy: 0 };

// CPU (top half)
const cpu = { x: CX, y: FY + 120, r: PLAYER_R, vx: 0, vy: 0, mistakeTimer: 0, errorX: 0, hitCool: 0 };

// ── Particles ──
const particles = [];
function burst(x, y, col1, col2, n = 22) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 7;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col: Math.random() > 0.5 ? col1 : col2, size: 2 + Math.random() * 4, glow: Math.random() > 0.4, gravity: 0.08 + Math.random() * 0.12 });
  }
}
function sparkLine(x1, y1, x2, y2, col, n = 8) {
  for (let i = 0; i < n; i++) {
    const t = Math.random(), x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 10, y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 10;
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col, size: 1.5 + Math.random() * 2, glow: true, gravity: 0.1 });
  }
}

// ── Input — portrait, player controls bottom half ──
let rawX = CX, rawY = FY + FH - 120;
let prevRawX = CX, prevRawY = FY + FH - 120;
let mouseVX = 0, mouseVY = 0;

function pointerToCanvas(clientX, clientY) {
  const r = CV.getBoundingClientRect();
  const sx = W / r.width;
  const sy = H / r.height;
  const nx = (clientX - r.left) * sx;
  const ny = (clientY - r.top) * sy;
  rawX = clamp(nx, FX + PLAYER_R + 2, FX + FW - PLAYER_R - 2);
  rawY = clamp(ny, CY + 10, FY + FH - PLAYER_R - 2);
}

CV.addEventListener("mousemove", e => pointerToCanvas(e.clientX, e.clientY));
document.addEventListener("mousemove", e => pointerToCanvas(e.clientX, e.clientY));
CV.addEventListener("touchmove", e => { e.preventDefault(); pointerToCanvas(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
CV.addEventListener("touchstart", e => { e.preventDefault(); pointerToCanvas(e.touches[0].clientX, e.touches[0].clientY); if (state === "title") startGame(); }, { passive: false });
document.addEventListener("keydown", e => { if (e.code === "KeyS") toggleMute(); if (e.code === "Space" && state === "over") startGame(); });
// ── Game flow ──
function startGame() {
  score.p = 0; score.cpu = 0; resetStats();
  ballSpeedMult = 1.0; lastSpeedUpAt = 0; speedUpMsg = ""; speedUpTimer = 0;
  sloMo = false; sloMoAlpha = 0; sloMoIntro = 0; sloMoLabelTimer = 0;
  confetti.length = 0;
  if (confettiInterval) { clearInterval(confettiInterval); confettiInterval = null; }
  resetRound("p");
  state = "play";
  if (readyEl) readyEl.classList.remove("on");
  gameoverEl.classList.remove("on", "lose-state");
  particles.length = 0;
  updateStatDOM();
}

function resetRound(server) {
  trail.length = 0;
  ball.x = CX; ball.y = CY; ball.vx = 0; ball.vy = 0;
  player.x = CX; player.y = FY + FH - 120; player.pvx = 0; player.pvy = 0;
  rawX = CX; rawY = FY + FH - 120;
  prevRawX = CX; prevRawY = FY + FH - 120;
  cpu.x = CX; cpu.y = FY + 120; cpu.vx = 0; cpu.vy = 0; cpu.mistakeTimer = 0; cpu.hitCool = 0;
  // Ball served toward server's goal
  if (server === "p") {
    ball.vy = -(3.5 + Math.random() * 1.5) * ballSpeedMult;
    ball.vx = (Math.random() - 0.5) * 3.5 * ballSpeedMult;
  } else {
    ball.vy = (3.5 + Math.random() * 1.5) * ballSpeedMult;
    ball.vx = (Math.random() - 0.5) * 3.5 * ballSpeedMult;
  }
}

function goalScored(who) {
  if (state !== "play") return;
  state = "goal"; goalWho = who; goalFlash = 160; goalMsgScale = 0;
  const ws = stats[who], ls = stats[who === "p" ? "cpu" : "p"];
  ws.goals++; ws.streak++; ws.bestStreak = Math.max(ws.bestStreak, ws.streak); ls.streak = 0;
  score[who]++;
  const totalGoals = score.p + score.cpu;
  if (totalGoals % 2 === 0 && totalGoals > lastSpeedUpAt) {
    lastSpeedUpAt = totalGoals; ballSpeedMult = Math.min(ballSpeedMult + 0.14, 2.0);
    const msgs = ["SPEEDING UP!","FASTER!!","NO MERCY!","LIGHT SPEED!","HOLD ON!!"];
    speedUpMsg = msgs[Math.min(Math.floor(totalGoals / 2 - 1), msgs.length - 1)]; speedUpTimer = 130;
  }
  if (who === "p") burst(CX, FY + FH, "#00d4ff", "#ffffff", 40);
  else burst(CX, FY, "#ff2d55", "#ffffff", 40);
  burst(ball.x, ball.y, "#ffc940", "#ffffff", 30);
  shake(8); playSound("goal");
  updateStatDOM();
  if ((score.p === MAX_SCORE - 1 || score.cpu === MAX_SCORE - 1) && !sloMo) {
    sloMo = true; sloMoIntro = 80; sloMoLabelTimer = 170;
  }
  setTimeout(() => {
    if (score.p >= MAX_SCORE || score.cpu >= MAX_SCORE) {
      state = "over";
      const playerWon = score.p >= MAX_SCORE;
      goWho.textContent = playerWon ? "YOU WIN" : "CPU WINS";
      goWho.style.color = playerWon ? "#00d4ff" : "#ff2d55";
      goWho.style.textShadow = playerWon ? "0 0 30px #00d4ff" : "0 0 30px #ff2d55";
      goWinsEl.textContent = playerWon ? "GAME · SET · MATCH" : "BETTER LUCK NEXT TIME";
      document.getElementById("go-face").textContent = playerWon ? "😄" : "😢";
      goFinal.textContent = `${score.p} – ${score.cpu}`;
      gameoverEl.classList.remove("lose-state");
      if (!playerWon) gameoverEl.classList.add("lose-state");
      burst(CX, CY, "#ffc940", "#ffffff", 80);
      if (playerWon) {
        playSound("victory"); spawnConfetti();
        setTimeout(spawnConfetti, 400); setTimeout(spawnConfetti, 800); setTimeout(spawnConfetti, 1400);
        confettiInterval = setInterval(spawnConfetti, 1400);
      }
            const name = prompt("Enter your name for the leaderboard:") || "Anonymous";
      fetch(`${API_BASE}/leaderboard`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerName: name.slice(0,20), score: score.p, streak: stats.p.bestStreak, topSpeed: stats.p.topSpeed }) }).catch(()=>{});
      gameoverEl.classList.add("on");
    } else {
      resetRound(who === "p" ? "cpu" : "p");
      state = "play";
    }
  }, 1500);
}

function shake(amt) { shakeAmt = Math.max(shakeAmt, amt); }

function updateStatDOM() {
  DOM.scoreP.textContent   = score.p;
  DOM.scoreCPU.textContent = score.cpu;
  DOM.pStreak.textContent  = stats.p.bestStreak;
  DOM.pSpeed.textContent   = stats.p.topSpeed;
  DOM.pPower.textContent   = stats.p.powerKicks;
  DOM.cpuStreak.textContent = stats.cpu.bestStreak;
  DOM.cpuSpeed.textContent  = stats.cpu.topSpeed;
  DOM.cpuPower.textContent  = stats.cpu.powerKicks;
}

// ── CPU AI (top half, defends top goal) ──
function updateCPU(ts = 1) {
  const homeY = FY + 120;
  const minX = FX + cpu.r + 2, maxX = FX + FW - cpu.r - 2;
  const minY = FY + cpu.r + 2, maxY = CY - 10;

  if (Math.random() < CPU_MISTAKE_CHANCE && cpu.mistakeTimer === 0 && ball.vy < 0) {
    cpu.mistakeTimer = CPU_MISTAKE_DUR; cpu.errorX = (Math.random() - 0.5) * CPU_ERROR_X * 2;
  }
  if (cpu.mistakeTimer > 0) cpu.mistakeTimer--;
  if (cpu.hitCool > 0) cpu.hitCool--;

  const err = cpu.mistakeTimer > 0 ? cpu.errorX : 0;
  const ballOnMySide = ball.y < CY;
  const ballHeadingToMe = ball.vy < 0;

  let tx, ty;
  if (ballOnMySide && ballHeadingToMe) {
    const frames = Math.max(1, Math.min((cpu.y - ball.y) / Math.max(0.5, -ball.vy), 60));
    tx = clamp(ball.x + ball.vx * frames * CPU_REACT + err, minX, maxX);
    ty = clamp(ball.y + ball.vy * frames * CPU_REACT, minY, maxY);
  } else if (ballOnMySide) {
    tx = clamp(ball.x + err, minX, maxX);
    ty = clamp(ball.y - 8, minY, maxY);
  } else {
    tx = clamp(ball.x * 0.5 + CX * 0.5 + err * 0.3, minX, maxX);
    ty = homeY;
  }

  const prevX = cpu.x, prevY = cpu.y;
  const dx = tx - cpu.x, dy = ty - cpu.y, dist = Math.hypot(dx, dy);
  if (dist > 0.1) { const step = Math.min(dist, CPU_SPEED * ts); cpu.x += (dx / dist) * step; cpu.y += (dy / dist) * step; }
  cpu.x = clamp(cpu.x, minX, maxX); cpu.y = clamp(cpu.y, minY, maxY);
  cpu.vx = cpu.x - prevX; cpu.vy = cpu.y - prevY;
}

// ── Ball physics ──
function updateBall() {
  if (state !== "play") return;
  const spd = Math.hypot(ball.vx, ball.vy);
  trail.push({ x: ball.x, y: ball.y, spd });
  if (trail.length > 18) trail.shift();

  if (spd < 0.8) { ball.vx += (Math.random() - 0.5) * 0.18; ball.vy += (Math.random() - 0.5) * 0.18; }
  else if (spd < 2.5) { ball.vx += (Math.random() - 0.5) * 0.06; ball.vy += (Math.random() - 0.5) * 0.06; }

  ball.x += ball.vx; ball.y += ball.vy;
  ball.vx *= FRICTION; ball.vy *= FRICTION;

  // Side walls
  if (ball.x - ball.r < FX) { ball.x = FX + ball.r; ball.vx = Math.abs(ball.vx) * WALL_BOUNCE; sparkLine(FX, ball.y - 20, FX, ball.y + 20, "#00d4ff"); playSound("wall"); }
  if (ball.x + ball.r > FX + FW) { ball.x = FX + FW - ball.r; ball.vx = -Math.abs(ball.vx) * WALL_BOUNCE; sparkLine(FX + FW, ball.y - 20, FX + FW, ball.y + 20, "#00d4ff"); playSound("wall"); }

  // Top wall / CPU goal
  if (ball.y - ball.r < FY) {
    if (ball.x > GOAL_X1 && ball.x < GOAL_X2) { goalScored("p"); return; }
    ball.y = FY + ball.r; ball.vy = Math.abs(ball.vy) * WALL_BOUNCE; sparkLine(ball.x - 20, FY, ball.x + 20, FY, "#ff2d55"); playSound("wall");
  }
  // Bottom wall / Player goal
  if (ball.y + ball.r > FY + FH) {
    if (ball.x > GOAL_X1 && ball.x < GOAL_X2) { goalScored("cpu"); return; }
    ball.y = FY + FH - ball.r; ball.vy = -Math.abs(ball.vy) * WALL_BOUNCE; sparkLine(ball.x - 20, FY + FH, ball.x + 20, FY + FH, "#ff2d55"); playSound("wall");
  }

  circleCollide(ball, player, true);
  circleCollide(ball, cpu, false);
}

function circleCollide(b, mallet, isPlayer) {
  const dx = b.x - mallet.x, dy = b.y - mallet.y, dist = Math.hypot(dx, dy);
  const minDist = b.r + mallet.r;
  if (dist >= minDist || dist < 0.01) return;
  if (!isPlayer && cpu.hitCool > 0) {
    const nx2 = dx / dist, ny2 = dy / dist; b.x += nx2 * (minDist - dist); b.y += ny2 * (minDist - dist); return;
  }
  const nx = dx / dist, ny = dy / dist;
  b.x += nx * (minDist - dist); b.y += ny * (minDist - dist);
  const mvx = isPlayer ? player.pvx * 1.8 : mallet.vx;
  const mvy = isPlayer ? player.pvy * 1.8 : mallet.vy;
  const relVX = b.vx - mvx, relVY = b.vy - mvy;
  const dot = relVX * nx + relVY * ny;
  if (dot >= 0) return;
  const restitution = isPlayer ? 1.3 : 1.1;
  const impulse = -(1 + restitution) * dot;
  b.vx += impulse * nx; b.vy += impulse * ny;
  const spd = Math.hypot(b.vx, b.vy);
  const cap = (isPlayer ? 20 : 16) * ballSpeedMult;
  if (spd > cap) { b.vx = (b.vx / spd) * cap; b.vy = (b.vy / spd) * cap; }
  if (!isPlayer) cpu.hitCool = 20;
  const who = isPlayer ? "p" : "cpu";
  const mphSpd = Math.round(spd * 4);
  if (mphSpd > stats[who].topSpeed) stats[who].topSpeed = mphSpd;
  if (spd > 14) stats[who].powerKicks++;
  updateStatDOM();
  if (spd > 3) {
    const col = isPlayer ? "#00d4ff" : "#ff2d55";
    burst(b.x, b.y, col, "#ffffff", Math.floor(spd * 1.5));
    if (spd > 19) shake(Math.min((spd - 19) * 0.4, 3));
    playSound("hit", spd);
  }
}

function updatePlayer(ts = 1) {
  const dx = rawX - prevRawX, dy = rawY - prevRawY;
  mouseVX = mouseVX * 0.4 + dx * 0.6; mouseVY = mouseVY * 0.4 + dy * 0.6;
  prevRawX = rawX; prevRawY = rawY;
  if (ts === 1) { player.x = rawX; player.y = rawY; }
  else {
    player.x += (rawX - player.x) * ts * 3; player.y += (rawY - player.y) * ts * 3;
    player.x = clamp(player.x, FX + PLAYER_R + 2, FX + FW - PLAYER_R - 2);
    player.y = clamp(player.y, CY + 10, FY + FH - PLAYER_R - 2);
  }
  player.pvx = mouseVX * ts; player.pvy = mouseVY * ts;
}

// ── Rendering ──
function grd(x, y, r0, r1, c0, c1) { const g = G.createRadialGradient(x, y, r0, x, y, r1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
function lgrad(x0, y0, x1, y1, stops) { const g = G.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => g.addColorStop(t, c)); return g; }

function drawPitch() {
  const fx = FX, fy = FY, fw = FW, fh = FH;

  // Outer glow
  G.save(); G.shadowColor = "rgba(0,180,255,0.2)"; G.shadowBlur = 28; G.strokeStyle = "rgba(0,180,255,0.25)"; G.lineWidth = 3;
  G.beginPath(); G.roundRect(fx - 4, fy - 4, fw + 8, fh + 8, 14); G.stroke(); G.restore();

  // Pitch surface — green feel
  G.fillStyle = lgrad(fx, fy, fx, fy + fh, [[0,"#071a0a"],[0.5,"#051208"],[1,"#071a0a"]]);
  G.beginPath(); G.roundRect(fx, fy, fw, fh, 10); G.fill();

  // Grass stripes
  G.save(); G.globalAlpha = 0.04;
  const stripeH = 40;
  for (let sy = fy; sy < fy + fh; sy += stripeH * 2) {
    G.fillStyle = "#22ff44";
    G.fillRect(fx, sy, fw, stripeH);
  }
  G.restore();

  // Center circle
  G.save(); G.strokeStyle = "rgba(255,255,255,0.12)"; G.lineWidth = 2; G.setLineDash([6, 6]);
  G.beginPath(); G.arc(CX, CY, 55, 0, Math.PI * 2); G.stroke(); G.setLineDash([]); G.restore();

  // Halfway line
  G.save(); G.strokeStyle = "rgba(255,255,255,0.10)"; G.lineWidth = 2; G.setLineDash([8, 8]);
  G.beginPath(); G.moveTo(fx + 2, CY); G.lineTo(fx + fw - 2, CY); G.stroke(); G.setLineDash([]); G.restore();

  // Center dot
  G.save(); G.shadowColor = "rgba(255,255,255,0.5)"; G.shadowBlur = 8; G.fillStyle = "rgba(255,255,255,0.35)";
  G.beginPath(); G.arc(CX, CY, 5, 0, Math.PI * 2); G.fill(); G.restore();

  // Penalty areas
  const paW = 160, paH = 60;
  G.save(); G.strokeStyle = "rgba(255,255,255,0.10)"; G.lineWidth = 1.5;
  // Top (CPU) penalty area
  G.strokeRect(CX - paW / 2, fy, paW, paH);
  // Bottom (player) penalty area
  G.strokeRect(CX - paW / 2, fy + fh - paH, paW, paH);
  G.restore();

  // Side rails
  G.fillStyle = lgrad(0, fy, 0, fy + 8, [[0,"#1a4a1e"],[0.6,"#0e2a10"],[1,"#071a0a"]]);
  G.fillRect(fx, fy, fw, 8);
  G.fillStyle = lgrad(0, fy + fh - 8, 0, fy + fh, [[0,"#071a0a"],[0.4,"#0e2a10"],[1,"#1a4a1e"]]);
  G.fillRect(fx, fy + fh - 8, fw, 8);

  // Rail glow lines
  G.save(); G.shadowColor = "#00ff44"; G.shadowBlur = 10; G.strokeStyle = "rgba(0,255,68,0.5)"; G.lineWidth = 2;
  G.beginPath(); G.moveTo(fx + 2, fy + 2); G.lineTo(fx + fw - 2, fy + 2); G.stroke();
  G.beginPath(); G.moveTo(fx + 2, fy + fh - 2); G.lineTo(fx + fw - 2, fy + fh - 2); G.stroke(); G.restore();

  // Top goal (CPU, red) — opening faces downward into field
  G.save(); G.shadowColor = "#ff2d55"; G.shadowBlur = 14; G.strokeStyle = "rgba(255,45,85,0.7)"; G.lineWidth = 2.5;
  G.beginPath(); G.moveTo(GOAL_X1, fy); G.lineTo(GOAL_X1, fy - GOAL_DEPTH); G.stroke();
  G.beginPath(); G.moveTo(GOAL_X2, fy); G.lineTo(GOAL_X2, fy - GOAL_DEPTH); G.stroke();
  G.strokeStyle = "rgba(255,45,85,0.3)"; G.lineWidth = 1.5;
  G.beginPath(); G.moveTo(GOAL_X1, fy - GOAL_DEPTH); G.lineTo(GOAL_X2, fy - GOAL_DEPTH); G.stroke(); G.restore();

  // Bottom goal (player, blue) — opening faces upward into field
  G.save(); G.shadowColor = "#00d4ff"; G.shadowBlur = 14; G.strokeStyle = "rgba(0,212,255,0.7)"; G.lineWidth = 2.5;
  G.beginPath(); G.moveTo(GOAL_X1, fy + fh); G.lineTo(GOAL_X1, fy + fh + GOAL_DEPTH); G.stroke();
  G.beginPath(); G.moveTo(GOAL_X2, fy + fh); G.lineTo(GOAL_X2, fy + fh + GOAL_DEPTH); G.stroke();
  G.strokeStyle = "rgba(0,212,255,0.3)"; G.lineWidth = 1.5;
  G.beginPath(); G.moveTo(GOAL_X1, fy + fh + GOAL_DEPTH); G.lineTo(GOAL_X2, fy + fh + GOAL_DEPTH); G.stroke(); G.restore();

  // Goal posts
  [[GOAL_X1, fy],[GOAL_X2, fy]].forEach(([gx, gy]) => {
    G.save(); G.shadowColor = "#ff2d55"; G.shadowBlur = 12; G.fillStyle = "#ff2d55";
    G.beginPath(); G.arc(gx, gy, 5, 0, Math.PI * 2); G.fill(); G.restore();
  });
  [[GOAL_X1, fy + FH],[GOAL_X2, fy + FH]].forEach(([gx, gy]) => {
    G.save(); G.shadowColor = "#00d4ff"; G.shadowBlur = 12; G.fillStyle = "#00d4ff";
    G.beginPath(); G.arc(gx, gy, 5, 0, Math.PI * 2); G.fill(); G.restore();
  });
}

function drawBall() {
  // Trail
  trail.forEach((t, i) => {
    const prog = i / trail.length, r = prog * 9 * Math.min(t.spd / 6, 1);
    if (r < 0.5) return;
    G.save(); G.globalAlpha = prog * 0.55 * Math.min(t.spd / 5, 1);
    G.fillStyle = grd(t.x, t.y, 0, r * 2, "rgba(255,255,200,0.9)", "transparent");
    G.beginPath(); G.arc(t.x, t.y, r * 2.2, 0, Math.PI * 2); G.fill(); G.restore();
  });

  const bx = ball.x, by = ball.y, br = ball.r;
  const spd = Math.hypot(ball.vx, ball.vy);

  // Outer glow
  G.save(); G.shadowColor = "#ffffff"; G.shadowBlur = 18 + spd * 1.2;
  G.fillStyle = grd(bx, by, 0, br + 8, "rgba(255,255,255,0.12)", "transparent");
  G.beginPath(); G.arc(bx, by, br + 12, 0, Math.PI * 2); G.fill(); G.restore();

  // Ball body — classic black & white soccer look
  G.fillStyle = grd(bx - br * 0.3, by - br * 0.3, br * 0.1, br, "#f0f0f0", "#c0c0c0");
  G.beginPath(); G.arc(bx, by, br, 0, Math.PI * 2); G.fill();

  // Pentagon patches
  G.save();
  G.fillStyle = "#111";
  const patches = [[0,-1],[ 0.95,-0.31],[ 0.59,0.81],[-0.59,0.81],[-0.95,-0.31]];
  patches.forEach(([px, py]) => {
    G.beginPath(); G.arc(bx + px * br * 0.58, by + py * br * 0.58, br * 0.28, 0, Math.PI * 2); G.fill();
  });
  G.restore();

  // Neon rim
  G.save(); G.shadowColor = "#aaffaa"; G.shadowBlur = 6; G.strokeStyle = "rgba(150,255,150,0.5)"; G.lineWidth = 1.5;
  G.beginPath(); G.arc(bx, by, br - 1, 0, Math.PI * 2); G.stroke(); G.restore();

  // Specular highlight
  G.fillStyle = "rgba(255,255,255,0.28)";
  G.beginPath(); G.ellipse(bx - br * 0.3, by - br * 0.3, br * 0.38, br * 0.22, -0.4, 0, Math.PI * 2); G.fill();
}

function drawPlayer(m, col, glowCol) {
  const mx = m.x, my = m.y, mr = m.r;

  // Shadow
  G.save(); G.globalAlpha = 0.4; G.fillStyle = "rgba(0,0,0,0.7)";
  G.beginPath(); G.ellipse(mx + 3, my + 4, mr, mr * 0.85, 0, 0, Math.PI * 2); G.fill(); G.restore();

  // Halo glow
  G.save(); G.shadowColor = glowCol; G.shadowBlur = 32;
  const halo = G.createRadialGradient(mx, my, mr * 0.6, mx, my, mr + 18);
  halo.addColorStop(0, "transparent"); halo.addColorStop(0.6, `${glowCol}22`); halo.addColorStop(1, "transparent");
  G.fillStyle = halo; G.beginPath(); G.arc(mx, my, mr + 18, 0, Math.PI * 2); G.fill(); G.restore();

  // Shirt base — jersey shape approximation
  const skirt = G.createRadialGradient(mx - mr * 0.2, my - mr * 0.2, mr * 0.1, mx, my, mr);
  skirt.addColorStop(0, lighten(col, 0.12)); skirt.addColorStop(0.65, col); skirt.addColorStop(1, darken(col, 0.45));
  G.fillStyle = skirt; G.beginPath(); G.arc(mx, my, mr, 0, Math.PI * 2); G.fill();

  // Neon rim
  G.save(); G.shadowColor = glowCol; G.shadowBlur = 12; G.strokeStyle = glowCol; G.lineWidth = 2.5;
  G.beginPath(); G.arc(mx, my, mr - 1.5, 0, Math.PI * 2); G.stroke(); G.restore();

  // Jersey number "10" on player, "CPU" symbol on cpu
  G.save(); G.textAlign = "center"; G.textBaseline = "middle";
  G.fillStyle = "rgba(255,255,255,0.7)"; G.font = `700 ${mr * 0.5}px Orbitron`;
  G.fillText(glowCol === "#00d4ff" ? "10" : "AI", mx, my); G.restore();

  // Highlight
  G.fillStyle = "rgba(255,255,255,0.22)";
  G.beginPath(); G.ellipse(mx - mr * 0.3, my - mr * 0.32, mr * 0.32, mr * 0.18, -0.5, 0, Math.PI * 2); G.fill();
}

function drawGoalFlash() {
  if (goalFlash <= 0 || state !== "goal") return;
  const prog = goalFlash / 160, isP = goalWho === "p";
  G.save(); G.globalAlpha = Math.min(prog * 3, 0.16);
  G.fillStyle = isP ? "#00d4ff" : "#ff2d55"; G.fillRect(0, 0, W, H); G.restore();
  goalMsgScale = Math.min(goalMsgScale + 0.12, 1);
  const ease = 1 - Math.pow(1 - goalMsgScale, 3);
  G.save(); G.globalAlpha = Math.min(1, prog * 3) * Math.min(1, goalFlash / 40);
  G.translate(W / 2, H / 2); G.scale(ease, ease); G.textAlign = "center";
  G.font = '900 56px "Orbitron"'; G.fillStyle = isP ? "#00d4ff" : "#ff2d55";
  G.shadowColor = isP ? "#00d4ff" : "#ff2d55"; G.shadowBlur = 40; G.fillText("GOAL! ⚽", 0, -10); G.shadowBlur = 0;
  G.font = '500 12px "Rajdhani"'; G.fillStyle = isP ? "rgba(0,212,255,0.75)" : "rgba(255,45,85,0.75)";
  G.fillText(isP ? "YOU SCORE" : "CPU SCORES", 0, 22); G.restore();
  goalFlash--;
}

function drawSpeedUpMsg() {
  if (speedUpTimer <= 0) return;
  const t = speedUpTimer / 130, scale = t > 0.85 ? 0.5 + (1 - (t - 0.85) / 0.15) * 0.5 : 1, alpha = t < 0.2 ? t / 0.2 : 1;
  G.save(); G.globalAlpha = alpha; G.translate(W / 2, H / 2 - 80); G.scale(scale, scale); G.textAlign = "center";
  G.font = '900 28px "Orbitron"'; G.fillStyle = "#000"; G.fillText(speedUpMsg, 2, 2);
  const g2 = G.createLinearGradient(-80, -24, 80, 8); g2.addColorStop(0, "#ffc940"); g2.addColorStop(1, "#ff6820");
  G.fillStyle = g2; G.shadowColor = "#ffc940"; G.shadowBlur = 24; G.fillText(speedUpMsg, 0, 0); G.restore();
  speedUpTimer--;
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.vx *= 0.96; p.life -= 0.028;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    G.save(); G.globalAlpha = Math.pow(p.life, 1.4) * 0.9;
    if (p.glow) { G.shadowColor = p.col; G.shadowBlur = 10; }
    G.fillStyle = p.col; G.beginPath(); G.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); G.fill(); G.restore();
  });
}

function updateBallScaled(ts) {
  if (ts !== 1) { ball.vx *= ts; ball.vy *= ts; }
  updateBall();
  if (ts !== 1 && state === "play") { ball.vx /= ts; ball.vy /= ts; }
  // Unstick ball if it gets trapped in a corner
  const spd = Math.hypot(ball.vx, ball.vy);
  if (spd < 0.5 && state === "play") {
    ball.vx = (Math.random() - 0.5) * 4 * ballSpeedMult;
    ball.vy = (Math.random() - 0.5) * 4 * ballSpeedMult;
  }
}

// ── Utilities ──
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function darken(hex, amt) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,(r-amt*255)|0)},${Math.max(0,(g-amt*255)|0)},${Math.max(0,(b-amt*255)|0)})`;
}
function lighten(hex, amt) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${clamp((r+amt*255)|0,0,255)},${clamp((g+amt*255)|0,0,255)},${clamp((b+amt*255)|0,0,255)})`;
}

// ── Main Loop ──
function loop() {
  tick++;
  G.clearRect(0, 0, W, H); G.fillStyle = "#04060a"; G.fillRect(0, 0, W, H);

  if (sloMo) sloMoAlpha = Math.min(sloMoAlpha + 0.055, 1);
  else sloMoAlpha = Math.max(sloMoAlpha - 0.07, 0);
  if (sloMoIntro > 0) sloMoIntro--;
  if (sloMoLabelTimer > 0) sloMoLabelTimer--;

  const ts = sloMo ? 0.55 : 1;

  if (shakeAmt > 0.3) { shakeX = (Math.random() - 0.5) * shakeAmt * 2; shakeY = (Math.random() - 0.5) * shakeAmt * 2; shakeAmt *= 0.72; }
  else { shakeX = 0; shakeY = 0; shakeAmt = 0; }

  G.save(); G.translate(shakeX, shakeY);
  drawPitch();

  if (state === "play" || state === "goal") {
    updatePlayer(ts); updateCPU(ts); updateBallScaled(ts); updateParticles();
  }
  updateConfetti();

  drawParticles(); drawBall();
  drawPlayer(cpu, "#2a0a0a", "#ff2d55");
  drawPlayer(player, "#0a1a2a", "#00d4ff");
  drawGoalFlash(); drawSpeedUpMsg(); drawConfetti();

  // Slo-mo overlay
  if (sloMoAlpha > 0) {
    const vig = G.createRadialGradient(W/2,H/2,H*0.15,W/2,H/2,H*0.75);
    vig.addColorStop(0,"transparent"); vig.addColorStop(1,`rgba(0,0,0,${0.65*sloMoAlpha})`);
    G.fillStyle = vig; G.fillRect(0, 0, W, H);
    const barH = 32 * sloMoAlpha;
    G.fillStyle = `rgba(0,0,0,${0.88*sloMoAlpha})`; G.fillRect(0,0,W,barH); G.fillRect(0,H-barH,W,barH);
    G.save(); G.globalAlpha = 0.15 * sloMoAlpha; G.fillStyle = "#ff0040"; G.fillRect(0,0,5,H); G.fillRect(W-5,0,5,H); G.fillStyle = "#0080ff"; G.fillRect(5,0,5,H); G.fillRect(W-10,0,5,H); G.restore();
    if (sloMoLabelTimer > 0) {
      const fadeOut = sloMoLabelTimer < 30 ? sloMoLabelTimer / 30 : 1;
      const alpha = fadeOut * sloMoAlpha, pulse = 0.88 + Math.sin(tick * 0.12) * 0.12;
      G.save(); G.globalAlpha = alpha * pulse; G.textAlign = "center"; G.font = '900 14px "Orbitron"';
      G.fillStyle = "#000"; G.fillText("⚡  GAME POINT  ⚡", W/2+1, barH*0.72+1);
      G.fillStyle = "#ffc940"; G.shadowColor = "#ffc940"; G.shadowBlur = 14;
      G.fillText("⚡  GAME POINT  ⚡", W/2, barH*0.72); G.restore();
    }
  }
  G.restore();
  requestAnimationFrame(loop);
}

loop();