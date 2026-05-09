const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const streakEl = document.querySelector("#streak");
const panel = document.querySelector("#panel");
const startButton = document.querySelector("#start");
const muteButton = document.querySelector("#mute");

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const pointer = { active: false, x: W / 2 };
const chef = { x: W / 2, y: H - 70, w: 86, h: 34, speed: 560 };
const drops = [];
const sparks = [];

let last = 0;
let spawnTimer = 0;
let score = 0;
let streak = 1;
let lives = 3;
let running = false;
let muted = false;
let audio;

const foods = [
  { name: "berry", color: "#f25d78", points: 10 },
  { name: "star noodle", color: "#f4d35e", points: 15 },
  { name: "mint cube", color: "#72d7a5", points: 20 },
  { name: "moon egg", color: "#f8f0c9", points: 25 },
];

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}

function beep(freq, duration, type = "sine", gain = 0.04) {
  if (muted) return;
  audio ||= new AudioContext();
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
  chef.x = W / 2;
  spawnTimer = 0;
  score = 0;
  streak = 1;
  lives = 3;
  running = true;
  panel.classList.add("hidden");
  updateHud();
  beep(330, 0.08, "square");
}

function updateHud() {
  scoreEl.textContent = score;
  streakEl.textContent = `x${streak}`;
}

function spawnDrop() {
  const bad = Math.random() < Math.min(0.16 + score / 3000, 0.38);
  const food = foods[Math.floor(Math.random() * foods.length)];
  drops.push({
    x: 45 + Math.random() * (W - 90),
    y: -40,
    r: bad ? 22 : 18,
    vy: 150 + Math.random() * 90 + score / 25,
    spin: Math.random() * Math.PI,
    bad,
    food,
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

function step(dt) {
  let dir = 0;
  if (keys.has("ArrowLeft") || keys.has("a")) dir -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dir += 1;
  chef.x += dir * chef.speed * dt;
  if (pointer.active) chef.x += (pointer.x - chef.x) * Math.min(1, dt * 8);
  chef.x = Math.max(chef.w / 2, Math.min(W - chef.w / 2, chef.x));

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnDrop();
    spawnTimer = Math.max(0.28, 0.82 - score / 4200);
  }

  for (let i = drops.length - 1; i >= 0; i -= 1) {
    const drop = drops[i];
    drop.y += drop.vy * dt;
    drop.spin += dt * 5;

    const caught =
      drop.y + drop.r > chef.y - chef.h / 2 &&
      drop.y - drop.r < chef.y + chef.h / 2 &&
      Math.abs(drop.x - chef.x) < chef.w / 2 + drop.r * 0.55;

    if (caught) {
      drops.splice(i, 1);
      if (drop.bad) {
        lives -= 1;
        streak = 1;
        addSparks(drop.x, drop.y, "#e45c47", 16);
        beep(90, 0.18, "sawtooth", 0.06);
      } else {
        score += drop.food.points * streak;
        streak = Math.min(streak + 1, 9);
        addSparks(drop.x, drop.y, drop.food.color, 12);
        beep(380 + streak * 45, 0.07, "triangle");
      }
      updateHud();
    } else if (drop.y - drop.r > H + 20) {
      drops.splice(i, 1);
      if (!drop.bad) {
        streak = 1;
        updateHud();
      }
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

  if (lives <= 0) {
    running = false;
    panel.querySelector("h1").textContent = "Kitchen closed";
    panel.querySelector("p").textContent = `Final score: ${score}. The moon is already asking for seconds.`;
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

  ctx.fillStyle = "#f3d98d";
  ctx.beginPath();
  ctx.arc(W - 100, 96, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c99765";
  ctx.beginPath();
  ctx.arc(W - 116, 84, 7, 0, Math.PI * 2);
  ctx.arc(W - 86, 104, 9, 0, Math.PI * 2);
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
    ctx.fillStyle = "#202020";
    ctx.beginPath();
    ctx.arc(0, 0, drop.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e45c47";
    ctx.fillRect(-4, -drop.r - 8, 8, 13);
  } else {
    ctx.fillStyle = drop.food.color;
    ctx.beginPath();
    ctx.roundRect(-drop.r, -drop.r, drop.r * 2, drop.r * 2, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(-drop.r + 7, -drop.r + 6, 9, 4);
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
  drawBackground(t);
  drops.forEach(drawDrop);
  sparks.forEach((s) => {
    ctx.globalAlpha = Math.max(s.life, 0);
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, 5, 5);
    ctx.globalAlpha = 1;
  });
  drawChef();
  drawLives();
}

function loop(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.033);
  last = t;
  if (running) step(dt);
  render(t);
  requestAnimationFrame(loop);
}

startButton.addEventListener("click", reset);
muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.textContent = muted ? "×" : "♪";
});

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (event.key === " " && !running) reset();
});
window.addEventListener("keyup", (event) => keys.delete(event.key));
canvas.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  pointer.x = (event.offsetX / canvas.clientWidth) * W;
});
canvas.addEventListener("pointermove", (event) => {
  if (pointer.active) pointer.x = (event.offsetX / canvas.clientWidth) * W;
});
window.addEventListener("pointerup", () => {
  pointer.active = false;
});
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
requestAnimationFrame(loop);
