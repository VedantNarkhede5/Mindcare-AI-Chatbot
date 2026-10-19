/* MindCare front-end. All personal data is stored only in this browser (localStorage). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const fmt = t => new Date(t).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/* ---------- Tabs ---------- */
$$(".tab").forEach(b => b.addEventListener("click", () => {
  $$(".tab").forEach(x => x.classList.toggle("active", x === b));
  $$(".panel").forEach(p => p.classList.toggle("active", p.id === b.dataset.tab));
  if (b.dataset.tab !== "breathe") stopBreath();
  if (b.dataset.tab === "mood") renderMood();
  if (b.dataset.tab === "journal") renderEntries();
}));

/* ---------- 1. Chat ---------- */
const log = $("#log"), form = $("#form"), input = $("#msg");
let history = [];
function add(text, cls) {
  const d = document.createElement("div");
  d.className = "msg " + cls;
  d.textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}
async function send(text) {
  add(text, "user");
  const typing = add("MindCare is typing…", "bot typing");
  try {
    const r = await fetch("/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history })
    });
    const data = await r.json();
    typing.remove();
    if (data.error) { add(data.error, "bot"); return; }
    add(data.reply, "bot" + (data.crisis ? " crisis" : ""));
    history.push({ role: "user", text }, { role: "model", text: data.reply });
  } catch (e) {
    typing.remove();
    add("Network error. Please check your connection and try again.", "bot");
  }
}
form.addEventListener("submit", e => {
  e.preventDefault();
  const t = input.value.trim();
  if (!t) return;
  input.value = "";
  send(t);
});
$$(".chips button").forEach(b => b.addEventListener("click", () => send(b.dataset.q)));
$("#clearChat").addEventListener("click", () => {
  history = [];
  log.innerHTML = "";
  add("Fresh start. How are you feeling right now?", "bot");
});

/* ---------- 2. Breathing ---------- */
const PATTERNS = {
  box:  [["Breathe in", 4, 1], ["Hold", 4, 1], ["Breathe out", 4, 0], ["Hold", 4, 0]],
  "478": [["Breathe in", 4, 1], ["Hold", 7, 1], ["Breathe out", 8, 0]],
  easy: [["Breathe in", 4, 1], ["Breathe out", 6, 0]]
};
let pattern = "box", running = false, phaseTimer = null, tickTimer = null, cycles = 0;
const orb = $("#orb");
$$("#patterns button").forEach(b => b.addEventListener("click", () => {
  pattern = b.dataset.p;
  $$("#patterns button").forEach(x => x.classList.toggle("on", x === b));
  if (running) { stopBreath(); startBreath(); }
}));
function runPhase(i) {
  if (!running) return;
  const steps = PATTERNS[pattern];
  const [label, secs, big] = steps[i % steps.length];
  if (i > 0 && i % steps.length === 0) { cycles++; $("#cycles").textContent = "Cycles: " + cycles; }
  $("#breathText").textContent = label;
  orb.style.transitionDuration = secs + "s";
  orb.style.transform = big ? "scale(2.1)" : "scale(1)";
  let left = secs;
  $("#orbCount").textContent = left;
  clearInterval(tickTimer);
  tickTimer = setInterval(() => { left--; if (left > 0) $("#orbCount").textContent = left; }, 1000);
  phaseTimer = setTimeout(() => runPhase(i + 1), secs * 1000);
}
function startBreath() { running = true; cycles = 0; $("#cycles").textContent = "Cycles: 0"; $("#breathBtn").textContent = "Stop"; runPhase(0); }
function stopBreath() {
  running = false; clearTimeout(phaseTimer); clearInterval(tickTimer);
  orb.style.transform = "scale(1)"; $("#orbCount").textContent = "";
  $("#breathBtn").textContent = "Start";
  $("#breathText").textContent = cycles ? "Well done. How do you feel?" : "Press start when you're ready";
}
$("#breathBtn").addEventListener("click", () => running ? stopBreath() : startBreath());

/* ---------- 3. Mood tracker ---------- */
let selMood = 0;
const FACES = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };
$$("#emojis button").forEach(b => b.addEventListener("click", () => {
  selMood = +b.dataset.m;
  $$("#emojis button").forEach(x => x.classList.toggle("sel", x === b));
}));
$("#saveMood").addEventListener("click", () => {
  if (!selMood) { $("#moodMsg").textContent = "Pick a face first."; return; }
  const moods = store.get("moods", []);
  moods.push({ v: selMood, note: $("#moodNote").value.trim(), t: Date.now() });
  store.set("moods", moods.slice(-100));
  $("#moodNote").value = "";
  $("#moodMsg").textContent = selMood <= 2
    ? "Thank you for being honest. Tough days happen. Try the Breathe tab or talk to MindCare."
    : "Saved. Nice to check in with yourself.";
  selMood = 0; $$("#emojis button").forEach(x => x.classList.remove("sel"));
  renderMood();
});
$("#clearMood").addEventListener("click", () => {
  if (confirm("Delete all mood history?")) { store.set("moods", []); renderMood(); }
});
function renderMood() {
  const moods = store.get("moods", []);
  const last = moods.slice(-7);
  const chart = $("#chart");
  chart.innerHTML = last.length ? "" : '<span class="empty">No check-ins yet.</span>';
  last.forEach(m => {
    const c = document.createElement("div"); c.className = "col";
    c.innerHTML = `<div class="b" style="height:${m.v * 20}%" title="${fmt(m.t)}"></div><small>${FACES[m.v]}</small>`;
    chart.appendChild(c);
  });
  $("#avg").textContent = last.length ? "Average: " + (last.reduce((a, m) => a + m.v, 0) / last.length).toFixed(1) + " / 5" : "";
  const list = $("#moodList");
  list.innerHTML = moods.length ? "" : '<li class="empty">Nothing saved yet.</li>';
  moods.slice().reverse().slice(0, 20).forEach(m => {
    const li = document.createElement("li");
    const box = document.createElement("div");
    box.innerHTML = `<div class="t">${fmt(m.t)}</div>`;
    const p = document.createElement("p");
    p.textContent = FACES[m.v] + (m.note ? "  " + m.note : "");
    box.appendChild(p); li.appendChild(box); list.appendChild(li);
  });
}

/* ---------- 4. Journal ---------- */
const PROMPTS = [
  "What is one small thing that went well today?",
  "What is weighing on your mind right now? Write it out without judging it.",
  "Name three things you are grateful for today.",
  "What would you say to a friend who felt the way you feel now?",
  "What is one thing you can let go of tonight?",
  "Describe a place where you feel calm and safe."
];
let pi = Math.floor(Math.random() * PROMPTS.length);
function showPrompt() { $("#prompt").textContent = PROMPTS[pi % PROMPTS.length]; }
$("#newPrompt").addEventListener("click", () => { pi++; showPrompt(); });
$("#saveEntry").addEventListener("click", () => {
  const text = $("#entry").value.trim();
  if (!text) return;
  const e = store.get("entries", []);
  e.push({ text, prompt: $("#prompt").textContent, t: Date.now() });
  store.set("entries", e.slice(-200));
  $("#entry").value = "";
  renderEntries();
});
function renderEntries() {
  const e = store.get("entries", []);
  const list = $("#entries");
  list.innerHTML = e.length ? "" : '<li class="empty">No entries yet.</li>';
  e.map((x, i) => [x, i]).reverse().forEach(([x, i]) => {
    const li = document.createElement("li");
    const box = document.createElement("div");
    box.innerHTML = `<div class="t">${fmt(x.t)}</div>`;
    const p = document.createElement("p"); p.textContent = x.text;
    box.appendChild(p);
    const del = document.createElement("button");
    del.className = "del"; del.title = "Delete"; del.textContent = "✕";
    del.addEventListener("click", () => {
      const all = store.get("entries", []); all.splice(i, 1); store.set("entries", all); renderEntries();
    });
    li.append(box, del); list.appendChild(li);
  });
}
showPrompt(); renderEntries();

/* ---------- 5. Grounding 5-4-3-2-1 ---------- */
const STEPS = [
  [5, "Name 5 things you can SEE", "Look around slowly. Notice colours, shapes and light."],
  [4, "Name 4 things you can TOUCH", "Feel your clothes, the chair, the floor, your hands."],
  [3, "Name 3 things you can HEAR", "Listen closely, near and far."],
  [2, "Name 2 things you can SMELL", "Or recall two smells you like."],
  [1, "Name 1 thing you can TASTE", "Or one good thing about yourself."]
];
let gi = 0;
function renderGround() {
  if (gi >= STEPS.length) {
    $("#gNum").textContent = "✓"; $("#gText").textContent = "You did it. Take a slow breath.";
    $("#gHint").textContent = "Notice how your body feels now compared to when you started.";
    $("#gInputs").innerHTML = ""; $("#gNext").style.display = "none"; $("#gBar").style.width = "100%";
    return;
  }
  const [n, t, h] = STEPS[gi];
  $("#gNum").textContent = n; $("#gText").textContent = t; $("#gHint").textContent = h;
  $("#gBar").style.width = (gi / STEPS.length * 100) + "%";
  $("#gNext").style.display = ""; $("#gNext").textContent = gi === STEPS.length - 1 ? "Finish" : "Next";
  const box = $("#gInputs"); box.innerHTML = "";
  for (let k = 0; k < n; k++) {
    const i = document.createElement("input"); i.placeholder = (k + 1) + "."; i.setAttribute("aria-label", t + " " + (k + 1)); box.appendChild(i);
  }
}
$("#gNext").addEventListener("click", () => { gi++; renderGround(); });
$("#gReset").addEventListener("click", () => { gi = 0; renderGround(); });
renderGround();
