const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const streakEl = document.querySelector("#streak");
const bestEl = document.querySelector("#best");
const levelEl = document.querySelector("#level");
const panel = document.querySelector("#panel");
const startButton = document.querySelector("#start");
const muteButton = document.querySelector("#mute");
const pauseButton = document.querySelector("#pause");

const W = canvas.width;
let H = canvas.height;
const keys = new Set();
const pointer = { active: false, x: W / 2 };
const viewport = { scale: 1, offsetX: 0, offsetY: 0, width: W, height: H };
const chef = { x: W / 2, y: H - 70, w: 86, h: 34, speed: 560 };
const drops = [];
const sparks = [];
const floaters = [];

let last = 0;
let spawnTimer = 0;
let score = 0;
let streak = 1;
let lives = 3;
let running = false;
let paused = false;
let muted = false;
let audio;
let slowMo = 0;
let magnet = 0;
let shield = 0;
let rush = 0;
let shake = 0;
let comboCatches = 0;
let level = 1;
let best = Number(localStorage.getItem("comet-kitchen-best") || 0);

const introTitle = "Comet Kitchen";
const introText = "Build combos, trigger Rush Mode, and grab powerups before the kitchen gets wild.";

const foods = [
  { name: "berry", color: "#f25d78", points: 10 },
  { name: "star noodle", color: "#f4d35e", points: 15 },
  { name: "mint cube", color: "#72d7a5", points: 20 },
  { name: "moon egg", color: "#f8f0c9", points: 25 },
];

const powerups = [
  { type: "slow", label: "T", color: "#f4b84a", text: "SLOW!" },
  { type: "magnet", label: "M", color: "#64d2ff", text: "MAGNET!" },
  { type: "shield", label: "S", color: "#a987ff", text: "SHIELD!" },
];

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  viewport.scale = canvas.width / W;
  H = canvas.height / viewport.scale;
  viewport.width = W * viewport.scale;
  viewport.height = H * viewport.scale;
  viewport.offsetX = 0;
  viewport.offsetY = 0;
  chef.y = H - 70;
  ctx.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.offsetX, viewport.offsetY);
}

function screenToWorldX(event) {
  const rect = canvas.getBoundingClientRect();
  const cssScale = canvas.width / rect.width;
  const canvasX = (event.clientX - rect.left) * cssScale;
  return (canvasX - viewport.offsetX) / viewport.scale;
}

function beep(freq, duration, type = "sine", gain = 0.04) {
  if (muted) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  audio ||= new AudioCtor();
  if (audio.state === "suspended") audio.resume();
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.frequency.value = freq;
  osc.type = type;
  amp.gain.value = gain;
  osc.connect(amp).connect(audio.destination);
  osc.start();
  amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.stop(audio.currentTime + duration);
}

function reset() {
  drops.length = 0;
  sparks.length = 0;
  floaters.length = 0;
  chef.x = W / 2;
  chef.y = H - 70;
  spawnTimer = 0;
  score = 0;
  streak = 1;
  lives = 3;
  slowMo = 0;
  magnet = 0;
  shield = 0;
  rush = 0;
  shake = 0;
  comboCatches = 0;
  level = 1;
  running = true;
  paused = false;
  pauseButton.textContent = "II";
  panel.querySelector("h1").textContent = introTitle;
  panel.querySelector("p").textContent = introText;
  startButton.textContent = "Start cooking";
  panel.classList.add("hidden");
  updateHud();
  beep(330, 0.08, "square");
}

function updateHud() {
  scoreEl.textContent = score;
  streakEl.textContent = rush > 0 ? `RUSH` : `x${streak}`;
  bestEl.textContent = best;
  levelEl.textContent = level;
}

function spawnDrop() {
  level = Math.floor(score / 650) + 1;
  const bad = Math.random() < Math.min(0.14 + level * 0.018, 0.42);
  const bonus = !bad && Math.random() < Math.min(0.07 + level * 0.004, 0.13);
  const food = foods[Math.floor(Math.random() * foods.length)];
  const powerup = bonus ? powerups[Math.floor(Math.random() * powerups.length)] : null;
  drops.push({
    x: 45 + Math.random() * (W - 90),
    y: -40,
    r: bad ? 22 : bonus ? 20 : 18,
    vy: 150 + Math.random() * 90 + level * 18 + (rush > 0 ? 70 : 0),
    spin: Math.random() * Math.PI,
    bad,
    bonus,
    powerup,
    food,
    near: false,
  });
}

function addSparks(x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    sparks.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 240,
      vy: (Math.random() - 0.8) * 220,
      life: 0.45 + Math.random() * 0.35,
      color,
    });
  }
}

function addFloater(text, x, y, color = "#f8f0c9") {
  floaters.push({ text, x, y, color, life: 0.9 });
}

function step(dt) {
  const rawDt = dt;
  if (slowMo > 0) {
    slowMo -= dt;
    dt *= 0.58;
  }
  magnet = Math.max(0, magnet - rawDt);
  shield = Math.max(0, shield - rawDt);
  rush = Math.max(0, rush - rawDt);
  shake = Math.max(0, shake - rawDt);

  let dir = 0;
  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) dir -= 1;
  if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dir += 1;
  chef.x += dir * chef.speed * dt;
  if (pointer.active) chef.x += (pointer.x - chef.x) * Math.min(1, dt * 8);
  chef.x = Math.max(chef.w / 2, Math.min(W - chef.w / 2, chef.x));

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnDrop();
    spawnTimer = Math.max(0.2, 0.82 - level * 0.045 - (rush > 0 ? 0.12 : 0));
  }

  for (let i = drops.length - 1; i >= 0; i -= 1) {
    const drop = drops[i];
    if (!drop.bad && magnet > 0) {
      const dx = chef.x - drop.x;
      const dy = chef.y - drop.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 210 && dist > 1) {
        drop.x += (dx / dist) * 240 * dt;
        drop.y += (dy / dist) * 80 * dt;
      }
    }
    drop.y += drop.vy * dt;
    drop.spin += dt * 5;

    const caught =
      drop.y + drop.r > chef.y - chef.h / 2 &&
      drop.y - drop.r < chef.y + chef.h / 2 &&
      Math.abs(drop.x - chef.x) < chef.w / 2 + drop.r * 0.55;

    if (caught) {
      drops.splice(i, 1);
      if (drop.bad) {
        if (shield > 0) {
          shield = 0;
          addFloater("BLOCK!", drop.x, drop.y, "#a987ff");
          addSparks(drop.x, drop.y, "#a987ff", 22);
          beep(520, 0.11, "square", 0.05);
        } else {
          lives -= 1;
          streak = 1;
          comboCatches = 0;
          shake = 0.28;
          addSparks(drop.x, drop.y, "#e45c47", 20);
          addFloater("OUCH!", drop.x, drop.y, "#e45c47");
          beep(90, 0.18, "sawtooth", 0.06);
        }
      } else {
        if (drop.bonus) {
          if (drop.powerup.type === "slow") slowMo = 4;
          if (drop.powerup.type === "magnet") magnet = 6;
          if (drop.powerup.type === "shield") shield = 9;
          score += 50 * streak;
          addFloater(drop.powerup.text, drop.x, drop.y, drop.powerup.color);
          beep(720, 0.12, "triangle", 0.05);
        } else {
          score += drop.food.points * streak * (rush > 0 ? 2 : 1);
        }
        comboCatches += 1;
        if (comboCatches > 0 && comboCatches % 10 === 0) {
          rush = 6;
          addFloater("RUSH MODE!", W / 2, chef.y - 90, "#f4d35e");
          beep(880, 0.14, "square", 0.05);
        }
        streak = Math.min(streak + 1, 9);
        addSparks(drop.x, drop.y, drop.food.color, 12);
        beep(380 + streak * 45, 0.07, "triangle");
      }
      updateHud();
    } else if (drop.y - drop.r > H + 20) {
      drops.splice(i, 1);
      if (!drop.bad) {
        streak = 1;
        comboCatches = 0;
        updateHud();
      }
    } else if (
      drop.bad &&
      !drop.near &&
      drop.y > chef.y - 12 &&
      Math.abs(drop.x - chef.x) < chef.w / 2 + drop.r + 36
    ) {
      drop.near = true;
      score += 5;
      addFloater("+5 NEAR", drop.x, chef.y - 42, "#98c7bd");
      updateHud();
    }
  }

  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    const s = sparks[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 420 * dt;
    s.life -= dt;
    if (s.life <= 0) sparks.splice(i, 1);
  }

  for (let i = floaters.length - 1; i >= 0; i -= 1) {
    const f = floaters[i];
    f.y -= 44 * dt;
    f.life -= dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }

  if (lives <= 0) {
    running = false;
    best = Math.max(best, score);
    localStorage.setItem("comet-kitchen-best", String(best));
    updateHud();
    panel.querySelector("h1").textContent = "Kitchen closed";
    panel.querySelector("p").textContent =
      score >= best
        ? `New best: ${score}. That run had moon-kitchen legend energy.`
        : `Final score: ${score}. Best: ${best}. One cleaner combo could beat it.`;
    startButton.textContent = "Cook again";
    panel.classList.remove("hidden");
  }
}

function drawBackground(t) {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#173333");
  gradient.addColorStop(1, "#241923");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 137.5 + Math.sin(t / 1200 + i) * 18) % W;
    const y = (i * 73 + t * 0.012) % H;
    ctx.fillRect(x, y, 2, 2);
  }

  const moonY = H > 900 ? 170 : 96;
  ctx.fillStyle = "#f3d98d";
  ctx.beginPath();
  ctx.arc(W - 100, moonY, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c99765";
  ctx.beginPath();
  ctx.arc(W - 116, moonY - 12, 7, 0, Math.PI * 2);
  ctx.arc(W - 86, moonY + 8, 9, 0, Math.PI * 2);
  ctx.fill();
}

function drawChef() {
  ctx.save();
  ctx.translate(chef.x, chef.y);
  ctx.fillStyle = "#1a1110";
  ctx.fillRect(-chef.w / 2, -chef.h / 2 + 12, chef.w, 18);
  ctx.fillStyle = "#d94d37";
  ctx.beginPath();
  ctx.roundRect(-chef.w / 2, -chef.h / 2, chef.w, chef.h, 12);
  ctx.fill();
  ctx.fillStyle = "#f7edd1";
  ctx.fillRect(-42, -28, 84, 14);
  ctx.fillStyle = "#97d6c9";
  ctx.fillRect(-28, -15, 56, 7);
  ctx.restore();
}

function drawDrop(drop) {
  ctx.save();
  ctx.translate(drop.x, drop.y);
  ctx.rotate(drop.spin);
  if (drop.bad) {
    ctx.strokeStyle = "rgba(228, 92, 71, 0.5)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, drop.r + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#202020";
    ctx.beginPath();
    ctx.arc(0, 0, drop.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e45c47";
    ctx.fillRect(-4, -drop.r - 8, 8, 13);
  } else {
    ctx.fillStyle = drop.bonus ? drop.powerup.color : drop.food.color;
    ctx.beginPath();
    ctx.roundRect(-drop.r, -drop.r, drop.r * 2, drop.r * 2, drop.bonus ? 14 : 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(-drop.r + 7, -drop.r + 6, 9, 4);
    if (drop.bonus) {
      ctx.rotate(-drop.spin);
      ctx.fillStyle = "#241307";
      ctx.font = "700 18px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(drop.powerup.label, 0, 2);
    }
  }
  ctx.restore();
}

function drawLives() {
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i < lives ? "#f25d78" : "rgba(246,240,223,0.22)";
    ctx.beginPath();
    ctx.arc(44 + i * 28, H - 38, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function render(t) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0d1211";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.offsetX, viewport.offsetY);
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * 14 * shake * 4, (Math.random() - 0.5) * 10 * shake * 4);
  }
  drawBackground(t);
  if (slowMo > 0) {
    ctx.fillStyle = "rgba(244, 184, 74, 0.08)";
    ctx.fillRect(0, 0, W, H);
  }
  if (rush > 0) {
    ctx.fillStyle = "rgba(242, 93, 120, 0.09)";
    ctx.fillRect(0, 0, W, H);
  }
  drops.forEach(drawDrop);
  sparks.forEach((s) => {
    ctx.globalAlpha = Math.max(s.life, 0);
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, 5, 5);
    ctx.globalAlpha = 1;
  });
  floaters.forEach((f) => {
    ctx.globalAlpha = Math.max(f.life, 0);
    ctx.fillStyle = f.color;
    ctx.font = "900 24px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  });
  drawChef();
  drawLives();
  drawPowerMeters();
  ctx.restore();
  if (paused) {
    ctx.fillStyle = "rgba(8, 12, 11, 0.56)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f6f0df";
    ctx.font = "900 46px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Paused", W / 2, H / 2);
  }
}

function drawPowerMeters() {
  const comboGoal = 10;
  const comboProgress = (comboCatches % comboGoal) / comboGoal;
  const barX = W / 2 - 150;
  const barY = H - 48;
  ctx.fillStyle = "rgba(8, 12, 11, 0.68)";
  ctx.fillRect(barX, barY, 300, 24);
  ctx.fillStyle = rush > 0 ? "#f25d78" : "#98c7bd";
  ctx.fillRect(barX, barY, 300 * (rush > 0 ? 1 : comboProgress), 24);
  ctx.fillStyle = "#f6f0df";
  ctx.font = "900 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(rush > 0 ? "RUSH MODE" : `RUSH ${comboCatches % comboGoal}/${comboGoal}`, W / 2, barY + 18);

  const meters = [
    { label: "RUSH", value: rush / 6, color: "#f25d78" },
    { label: "MAG", value: magnet / 6, color: "#64d2ff" },
    { label: "SAFE", value: shield / 9, color: "#a987ff" },
    { label: "SLOW", value: slowMo / 4, color: "#f4b84a" },
  ].filter((meter) => meter.value > 0);

  meters.forEach((meter, i) => {
    const x = W - 190;
    const y = H - 36 - i * 24;
    ctx.fillStyle = "rgba(8, 12, 11, 0.68)";
    ctx.fillRect(x, y, 150, 13);
    ctx.fillStyle = meter.color;
    ctx.fillRect(x, y, 150 * Math.min(meter.value, 1), 13);
    ctx.fillStyle = "#f6f0df";
    ctx.font = "800 10px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(meter.label, x + 6, y + 10);
  });
}

function loop(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.033);
  last = t;
  if (running && !paused) step(dt);
  render(t);
  requestAnimationFrame(loop);
}

startButton.addEventListener("click", reset);
pauseButton.addEventListener("click", () => {
  if (!running) return;
  paused = !paused;
  pauseButton.textContent = paused ? ">" : "II";
});
muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.textContent = muted ? "X" : "♪";
});

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  if ((event.key === "p" || event.key === "P") && running) {
    paused = !paused;
    pauseButton.textContent = paused ? ">" : "II";
    return;
  }
  keys.add(event.key);
  if (event.key === " " && !running) reset();
});
window.addEventListener("keyup", (event) => keys.delete(event.key));
canvas.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  pointer.x = screenToWorldX(event);
});
canvas.addEventListener("pointermove", (event) => {
  if (pointer.active) pointer.x = screenToWorldX(event);
});
window.addEventListener("pointerup", () => {
  pointer.active = false;
});
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
updateHud();
requestAnimationFrame(loop);
