import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import express from "express";
import { getSettings, resolvedMode, requireLlmKey } from "./config.js";
import { buildGraph } from "./graph.js";
import { resumePipeline, runPipeline } from "./pipeline.js";
import { normalizeDecision } from "./human.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

const runs = new Map();
const MAX_EVENT_LOG = 200;

function publicRun(run) {
  return {
    id: run.id,
    status: run.status,
    playable: Boolean(run.state?.playable),
    species: run.state?.species,
    theme: run.state?.theme,
    retries: run.state?.retries ?? 0,
    mode: run.state?.mode,
    log: run.state?.log || [],
    interrupt: run.state?.__interrupt__ || null,
    testReport: run.state?.testReport || null,
    error: run.error || null,
    createdAt: run.createdAt,
  };
}

function publicGame(run) {
  if (!run?.state) return null;
  return {
    id: run.id,
    playable: Boolean(run.state.playable),
    status: run.status,
    design: run.state.design,
    art: run.state.art,
    species: run.state.species,
    theme: run.state.theme,
  };
}

function emit(run, event) {
  const entry = { ...event, ts: new Date().toISOString() };
  run.events.push(entry);
  if (run.events.length > MAX_EVENT_LOG) run.events.shift();
  for (const client of run.clients) {
    try {
      client.write(`event: ${entry.type}\ndata: ${JSON.stringify(entry)}\n\n`);
    } catch {
      // Drop a broken SSE client on the next sweep.
    }
  }
}

function onEventFor(run) {
  return (event) => {
    if (event.type === "node_start") {
      run.status = "running";
      emit(run, { type: "agent_start", node: event.node });
    } else if (event.type === "node_end") {
      for (const line of event.log || []) {
        emit(run, { type: "log", node: event.node, message: line });
      }
      emit(run, { type: "agent_end", node: event.node });
    } else if (event.type === "interrupt") {
      run.status = "interrupted";
      emit(run, { type: "interrupt", node: event.node, payload: event.payload });
    } else if (event.type === "complete") {
      run.state = event.state;
      run.status = event.state?.status || (event.state?.playable ? "playable" : "failed");
      emit(run, { type: "complete", status: run.status, playable: Boolean(event.state?.playable) });
    } else if (event.type === "error") {
      emit(run, { type: "error", node: event.node, message: event.message });
    }
  };
}

async function startRun(body = {}) {
  const settings = getSettings({
    mode: body.mode,
    species: body.species,
    theme: body.theme,
    autoApprove: body.autoApprove,
    maxRetries: body.maxRetries,
    outputDir: path.join(ROOT, "output", "runs", "pending"),
  });
  const mode = resolvedMode(settings);
  if (mode === "llm") requireLlmKey(settings);

  const id = randomUUID();
  const outputDir = path.join(ROOT, "output", "runs", id);
  fs.mkdirSync(outputDir, { recursive: true });
  settings.outputDir = outputDir;
  settings.mode = body.mode || settings.mode;

  const graph = buildGraph(settings);
  const run = {
    id,
    settings,
    graph,
    threadId: id,
    state: { log: [], status: "running", autoApprove: settings.autoApprove },
    status: "running",
    events: [],
    clients: new Set(),
    createdAt: new Date().toISOString(),
    error: null,
  };
  runs.set(id, run);
  runs.set("latest", run);

  const work = runPipeline({
    settings: { ...settings, outputDir, autoApprove: settings.autoApprove, mode: settings.mode },
    outputDir,
    graph,
    threadId: id,
    pauseOnInterrupt: true,
    onEvent: onEventFor(run),
  })
    .then((result) => {
      run.state = result;
      if (result.interrupted || result.__interrupt__) {
        run.status = "interrupted";
      } else {
        run.status = result.status || (result.playable ? "playable" : "failed");
      }
    })
    .catch((err) => {
      run.error = err.message;
      run.status = "error";
      emit(run, { type: "error", message: err.message });
    });

  run.work = work;
  return run;
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "pet-game-agents-web" });
  });

  app.get("/js/game.js", (_req, res) => {
    res.type("application/javascript");
    res.sendFile(path.join(ROOT, "src", "game.js"));
  });

  app.post("/api/runs", async (req, res) => {
    try {
      const run = await startRun(req.body || {});
      res.status(201).json(publicRun(run));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/runs/latest", (_req, res) => {
    const run = runs.get("latest");
    if (!run) return res.status(404).json({ error: "No runs yet" });
    res.json({ ...publicRun(run), game: publicGame(run) });
  });

  app.get("/api/runs/:id", (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json({ ...publicRun(run), game: publicGame(run) });
  });

  app.get("/api/runs/:id/game", (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) return res.status(404).json({ error: "Run not found" });
    if (!run.state?.design) return res.status(409).json({ error: "Game is not ready yet" });
    res.json(publicGame(run));
  });

  app.get("/api/runs/:id/events", (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write("event: hello\ndata: {\"ok\":true}\n\n");
    for (const event of run.events) {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }
    // If the run already finished before the client subscribed, replay the terminal state.
    if (run.status === "interrupted" && run.state?.__interrupt__) {
      res.write(
        `event: interrupt\ndata: ${JSON.stringify({
          type: "interrupt",
          payload: run.state.__interrupt__,
          ts: new Date().toISOString(),
        })}\n\n`,
      );
    } else if (run.status === "playable" || run.status === "failed" || run.status === "error") {
      res.write(
        `event: complete\ndata: ${JSON.stringify({
          type: "complete",
          status: run.status,
          playable: Boolean(run.state?.playable),
          ts: new Date().toISOString(),
        })}\n\n`,
      );
    }
    run.clients.add(res);
    const heartbeat = setInterval(() => {
      res.write(`event: ping\ndata: {}\n\n`);
    }, 15000);
    req.on("close", () => {
      clearInterval(heartbeat);
      run.clients.delete(res);
    });
  });

  app.post("/api/runs/:id/decision", async (req, res) => {
    const run = runs.get(req.params.id);
    if (!run) return res.status(404).json({ error: "Run not found" });
    if (run.status !== "interrupted") {
      return res.status(409).json({ error: `Run is not waiting for a decision (status=${run.status})` });
    }
    const payload = run.state.__interrupt__ || { defaults: { species: run.state.species, theme: run.state.theme } };
    const decision = normalizeDecision(req.body || {}, payload);
    try {
      run.status = "running";
      emit(run, { type: "decision", species: decision.species, theme: decision.theme });
      const result = await resumePipeline(run.graph, run.threadId, decision, {
        onEvent: onEventFor(run),
        outputDir: run.settings.outputDir,
        settings: run.settings,
      });
      run.state = result;
      if (result.__interrupt__) run.status = "interrupted";
      else run.status = result.status || (result.playable ? "playable" : "failed");
      res.json(publicRun(run));
    } catch (err) {
      run.error = err.message;
      run.status = "error";
      emit(run, { type: "error", message: err.message });
      res.status(500).json({ error: err.message });
    }
  });

  app.use(express.static(PUBLIC_DIR));

  app.use((req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  return app;
}

export function startServer(overrides = {}) {
  const settings = getSettings(overrides);
  const app = createApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(settings.port, "0.0.0.0", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : settings.port;
      console.log(`pet-game-agents-web listening on http://127.0.0.1:${port}`);
      resolve({ app, server, port, url: `http://127.0.0.1:${port}` });
    });
    server.on("error", reject);
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
