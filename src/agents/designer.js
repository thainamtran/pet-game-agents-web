import { defaultDesign, normalizeDesign, validateDesign } from "../design.js";
import { LLMError, completeJson } from "../llm.js";
import { resolvedMode } from "../config.js";
import { writeJson } from "../files.js";

const SYSTEM_PROMPT = `You are GameDesigner, an expert at cozy pet-raising games (Tamagotchi-style).
Design a small, balanced pet game. Hunger is a fullness meter: 100 is well fed, 0 is starving.
Every action must advance one turn and apply idle decay.
Return a single JSON object with camelCase keys:
{
  "title": str, "theme": str, "species": str, "petNameDefault": str,
  "stats": {
    "hunger": {"min": 0, "max": 100, "start": int, "decayPerTurn": int},
    "happiness": {"min": 0, "max": 100, "start": int, "decayPerTurn": int},
    "energy": {"min": 0, "max": 100, "start": int, "decayPerTurn": int}
  },
  "leveling": {"xpPerAction": int, "xpToLevel": int, "maxLevel": int},
  "actions": [
    {"id": "feed", "label": "Feed", "effects": {"hunger": int, "energy": int, "happiness": int}},
    {"id": "play", "label": "Play", "effects": {"happiness": int, "energy": int, "hunger": int}},
    {"id": "sleep", "label": "Sleep", "effects": {"energy": int, "hunger": int, "happiness": int}}
  ],
  "notes": str
}
Keep the game fair: alternating feed, play, and sleep for about 8 turns should stay alive and reach at least level 2.
Start stats 65-85. Modest decay. JSON only.`;

export async function designerNode(state, settings) {
  const mode = state.mode || resolvedMode(settings);
  let design;
  if (mode === "llm") {
    try {
      let user = `Species: ${state.species}\nTheme: ${state.theme}\n`;
      const report = state.testReport;
      if (report && !report.passed) {
        user += `Previous test report: ${report.summary}\nIssues: ${JSON.stringify(report.issues)}\n`;
      }
      const data = await completeJson(settings, { system: SYSTEM_PROMPT, user });
      data.species = state.species;
      data.theme = state.theme;
      design = normalizeDesign(data);
    } catch (err) {
      const message = err instanceof LLMError ? err.message : String(err);
      return {
        design: null,
        playable: false,
        failureCategory: "design",
        log: [`designer: LLM failed (${message}); leaving design unset`],
      };
    }
  } else {
    design = defaultDesign(state.species, state.theme);
    const report = state.testReport;
    if (report && report.category === "design") {
      for (const spec of Object.values(design.stats || {})) {
        if (spec && typeof spec === "object" && "decayPerTurn" in spec) {
          spec.decayPerTurn = Math.max(2, Number(spec.decayPerTurn) - 2);
        }
      }
    }
  }

  const issues = validateDesign(design);
  if (issues.length) {
    return {
      design,
      playable: false,
      failureCategory: "design",
      log: [`designer: invalid design: ${issues.join("; ")}`],
    };
  }

  const designPath = writeJson(state.outputDir, "design.json", design);
  return {
    design,
    filesWritten: [designPath],
    log: [`designer: designed ${design.title} (${design.species}, ${design.theme}) in ${mode} mode`],
  };
}
