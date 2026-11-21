import { Pet } from "/js/game.js";

const startForm = document.querySelector("#start-form");
const startBtn = document.querySelector("#start-btn");
const runStatus = document.querySelector("#run-status");
const logEl = document.querySelector("#log");
const decisionCard = document.querySelector("#decision-card");
const decisionForm = document.querySelector("#decision-form");
const decisionQuestion = document.querySelector("#decision-question");
const decisionDetails = document.querySelector("#decision-details");
const gamePlaceholder = document.querySelector("#game-placeholder");
const gameRoot = document.querySelector("#game-root");
const spriteEl = document.querySelector("#sprite");
const asciiEl = document.querySelector("#ascii");
const petMeta = document.querySelector("#pet-meta");
const barsEl = document.querySelector("#bars");
const moodLine = document.querySelector("#mood-line");
const gameMessage = document.querySelector("#game-message");
const restartBtn = document.querySelector("#restart-btn");

let currentRunId = null;
let eventSource = null;
let pet = null;
let currentArt = null;

function setStatus(text, kind = "") {
  runStatus.hidden = !text;
  runStatus.textContent = text;
  runStatus.className = `status-pill${kind ? ` ${kind}` : ""}`;
}

function appendLog(message, node = "") {
  const item = document.createElement("li");
  if (node) item.className = node;
  const label = node ? `${node}: ` : "";
  item.textContent = `${label}${message}`;
  logEl.prepend(item);
}

function clearLog() {
  logEl.innerHTML = "";
}

function showDecision(payload) {
  decisionCard.hidden = false;
  decisionQuestion.textContent = payload.question || "Please choose a species and theme.";
  decisionDetails.textContent = payload.details || "";
  const defaults = payload.defaults || {};
  decisionForm.species.value = defaults.species || "cat";
  decisionForm.theme.value = defaults.theme || "cozy backyard companion";
  setStatus("Waiting for your decision", "warn");
}

function hideDecision() {
  decisionCard.hidden = true;
}

function renderBars(snapshot) {
  const stats = [
    ["Hunger", "hunger", snapshot.hunger],
    ["Happiness", "happiness", snapshot.happiness],
    ["Energy", "energy", snapshot.energy],
  ];
  barsEl.innerHTML = stats
    .map(
      ([label, key, value]) => `
      <div class="bar-row">
        <span>${label}</span>
        <div class="track" aria-hidden="true"><div class="fill ${key}" style="width:${value}%"></div></div>
        <span>${value}</span>
      </div>`,
    )
    .join("");
}

function renderPet() {
  if (!pet) return;
  const snap = pet.snapshot();
  const mood = snap.mood;
  const svg = currentArt?.svgs?.[mood] || currentArt?.svgs?.happy || "";
  spriteEl.innerHTML = svg;
  asciiEl.textContent = pet.asciiArt();
  petMeta.textContent = `${snap.name} the ${snap.species}  ·  Level ${snap.level} (${snap.xp}/${snap.xpToLevel} XP)`;
  moodLine.textContent = snap.alive
    ? `Mood: ${mood}  ·  Turn ${snap.turn}  ·  ${snap.theme}`
    : "Game over — a stat reached zero. Start a fresh pet to try again.";
  renderBars(snap);
  gameRoot.hidden = false;
  gamePlaceholder.hidden = true;
  for (const btn of document.querySelectorAll("#actions button")) {
    btn.disabled = !snap.alive;
  }
}

function startGame(game) {
  if (!game?.design) return;
  currentArt = game.art || { ascii: {}, svgs: {} };
  pet = new Pet({
    design: game.design,
    species: game.species || game.design.species,
    name: game.design.petNameDefault || game.design.pet_name_default,
    ascii: currentArt.ascii,
  });
  gameMessage.textContent = pet.logs.at(-1) || `Meet ${pet.name}.`;
  renderPet();
}

function applyAction(action) {
  if (!pet) return;
  if (action === "feed") pet.feed();
  else if (action === "play") pet.play();
  else if (action === "sleep") pet.sleep();
  else pet.wait();
  gameMessage.textContent = pet.logs.at(-1) || "";
  renderPet();
}

function closeEvents() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function listen(runId) {
  closeEvents();
  currentRunId = runId;
  eventSource = new EventSource(`/api/runs/${runId}/events`);
  const onLog = (event) => {
    const data = JSON.parse(event.data);
    if (data.message) appendLog(data.message, data.node || "");
  };
  eventSource.addEventListener("log", onLog);
  eventSource.addEventListener("agent_start", (event) => {
    const data = JSON.parse(event.data);
    appendLog(`started`, data.node);
    setStatus(`Running: ${data.node}`);
  });
  eventSource.addEventListener("interrupt", (event) => {
    const data = JSON.parse(event.data);
    showDecision(data.payload || {});
  });
  eventSource.addEventListener("complete", async (event) => {
    const data = JSON.parse(event.data);
    hideDecision();
    if (data.playable) {
      setStatus("Playable");
      const response = await fetch(`/api/runs/${runId}/game`);
      const game = await response.json();
      startGame(game);
    } else {
      setStatus(data.status || "Finished", "bad");
    }
    closeEvents();
  });
  eventSource.addEventListener("error", (event) => {
    if (event.data) {
      try {
        const data = JSON.parse(event.data);
        appendLog(data.message || "Something went wrong", "error");
        setStatus("Error", "bad");
      } catch {
        // EventSource also fires "error" on connection hiccups.
      }
    }
  });
}

startForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideDecision();
  clearLog();
  gameRoot.hidden = true;
  gamePlaceholder.hidden = false;
  startBtn.disabled = true;
  setStatus("Starting…");
  try {
    const body = {
      species: startForm.species.value,
      theme: startForm.theme.value,
      autoApprove: startForm.autoApprove.checked,
      mode: "auto",
    };
    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not start a run");
    appendLog(`run ${data.id} created`);
    listen(data.id);
  } catch (err) {
    setStatus(err.message, "bad");
  } finally {
    startBtn.disabled = false;
  }
});

decisionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentRunId) return;
  const body = {
    species: decisionForm.species.value,
    theme: decisionForm.theme.value,
  };
  const response = await fetch(`/api/runs/${currentRunId}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "Could not send decision", "bad");
    return;
  }
  hideDecision();
  setStatus("Building…");
});

document.querySelector("#actions").addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  applyAction(btn.dataset.action);
});

restartBtn.addEventListener("click", async () => {
  if (!currentRunId) return;
  const response = await fetch(`/api/runs/${currentRunId}/game`);
  if (!response.ok) return;
  startGame(await response.json());
});

async function restoreLatest() {
  try {
    const response = await fetch("/api/runs/latest");
    if (!response.ok) return;
    const data = await response.json();
    currentRunId = data.id;
    if (data.log) {
      for (const line of data.log) appendLog(line);
    }
    if (data.status === "interrupted" && data.interrupt) {
      showDecision(data.interrupt);
      listen(data.id);
    } else if (data.playable && data.game) {
      setStatus("Playable");
      startGame(data.game);
    } else if (data.status === "running") {
      listen(data.id);
      setStatus("Running");
    }
  } catch {
    // First visit — no prior run.
  }
}

restoreLatest();
