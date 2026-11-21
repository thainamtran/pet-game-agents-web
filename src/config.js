import fs from "node:fs";
import path from "node:path";

function loadDotenv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

export function loadEnv(cwd = process.cwd()) {
  loadDotenv(path.join(cwd, ".env"));
}

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null ? fallback : String(value).trim();
}

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

export function getSettings(overrides = {}) {
  loadEnv();
  const mode = String(overrides.mode ?? env("LLM_MODE", "auto") ?? "auto").toLowerCase();
  if (!["auto", "mock", "llm"].includes(mode)) {
    throw new Error(`Invalid LLM_MODE / mode: ${mode} (use auto, mock, or llm)`);
  }
  const keyRaw = overrides.openaiApiKey ?? env("OPENAI_API_KEY");
  const openaiApiKey = keyRaw ? String(keyRaw).trim() : "";
  const autoApprove =
    overrides.autoApprove !== undefined
      ? Boolean(overrides.autoApprove)
      : truthy(env("PET_GAME_AUTO_APPROVE", "false"));
  const maxRetries =
    overrides.maxRetries !== undefined
      ? Number(overrides.maxRetries)
      : Number(env("PET_GAME_MAX_RETRIES", "3") || "3");
  const outputDir = path.resolve(
    process.cwd(),
    overrides.outputDir || env("PET_GAME_OUTPUT_DIR", "output") || "output",
  );
  const settings = {
    mode,
    openaiApiKey: openaiApiKey || null,
    openaiBaseUrl: String(
      overrides.openaiBaseUrl || env("OPENAI_BASE_URL", "https://api.openai.com/v1") || "https://api.openai.com/v1",
    ).replace(/\/$/, ""),
    openaiModel: String(overrides.openaiModel || env("OPENAI_MODEL", "gpt-4o-mini") || "gpt-4o-mini"),
    species: String(overrides.species || env("PET_GAME_SPECIES", "cat") || "cat")
      .trim()
      .toLowerCase(),
    theme: String(
      overrides.theme || env("PET_GAME_THEME", "cozy backyard companion") || "cozy backyard companion",
    ).trim(),
    autoApprove,
    maxRetries: Number.isFinite(maxRetries) ? maxRetries : 3,
    outputDir,
    port: Number(overrides.port || env("PORT", "3100") || "3100"),
  };
  return settings;
}

export function resolvedMode(settings) {
  if (settings.mode === "llm") return "llm";
  if (settings.mode === "mock") return "mock";
  return settings.openaiApiKey ? "llm" : "mock";
}

export function requireLlmKey(settings) {
  if (!settings.openaiApiKey) {
    throw new Error(
      "LLM mode was requested but OPENAI_API_KEY is not set. Use mock mode, or set OPENAI_API_KEY (see .env.example).",
    );
  }
  return settings.openaiApiKey;
}
