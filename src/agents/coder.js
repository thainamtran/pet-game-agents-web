import path from "node:path";
import { writeJson, writeText } from "../files.js";
import { resolvedMode } from "../config.js";
import { LLMError, completeJson } from "../llm.js";

function brokenBundle(design) {
  return {
    design,
    broken: true,
    // Missing actions / playability hooks on purpose.
    notes: "Intentionally incomplete bundle used to exercise retry.",
  };
}

export async function coderNode(state, settings) {
  const design = state.design;
  if (!design) {
    return {
      playable: false,
      failureCategory: "design",
      log: ["coder: no design available, cannot write the game"],
    };
  }

  const remaining = Number(state.injectCoderFailures || 0);
  if (remaining > 0) {
    const bundlePath = writeJson(state.outputDir, "game-bundle.json", brokenBundle(design));
    return {
      filesWritten: [bundlePath],
      bundle: brokenBundle(design),
      injectCoderFailures: remaining - 1,
      log: ["coder: injected a broken build for retry testing"],
    };
  }

  const mode = state.mode || resolvedMode(settings);
  let bundle = {
    title: design.title,
    species: design.species,
    theme: design.theme,
    design,
    engine: "little-companion-js",
    generatedAt: new Date().toISOString(),
  };

  if (mode === "llm") {
    try {
      let user = `DESIGN = ${JSON.stringify(design, null, 2)}\n`;
      const report = state.testReport;
      if (report && !report.passed) {
        user += `\nPrevious tests failed: ${report.summary}\nIssues: ${JSON.stringify(report.issues)}\n`;
      }
      const data = await completeJson(settings, {
        system:
          "You refine a pet-game design bundle. Return JSON { design, title, species, theme }. Keep required stats and feed/play/sleep actions. Hunger is fullness (higher is better). JSON only.",
        user,
      });
      if (data?.design) bundle.design = { ...design, ...data.design, species: state.species, theme: state.theme };
    } catch (err) {
      const message = err instanceof LLMError ? err.message : String(err);
      return {
        playable: false,
        failureCategory: "code",
        log: [`coder: LLM failed (${message})`],
      };
    }
  }

  const bundlePath = writeJson(state.outputDir, "game-bundle.json", bundle);
  const readmePath = path.join(state.outputDir, "GAME.md");
  writeText(
    state.outputDir,
    "GAME.md",
    `# ${design.title}\n\nA cozy pet-raising game (${design.species}, ${design.theme}).\nPlay it in the web UI after the pipeline finishes.\n`,
  );
  return {
    filesWritten: [bundlePath, readmePath],
    bundle,
    injectCoderFailures: 0,
    log: [`coder: wrote game-bundle.json in ${mode} mode`],
  };
}
