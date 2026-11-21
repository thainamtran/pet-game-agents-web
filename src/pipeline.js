import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSettings, resolvedMode, requireLlmKey } from "./config.js";
import { buildGraph, initialState } from "./graph.js";
import { defaultDecision, normalizeDecision } from "./human.js";
import { writeJson } from "./files.js";

export async function runPipeline(options = {}) {
  const settings = options.settings || getSettings(options);
  const mode = resolvedMode(settings);
  if (mode === "llm") requireLlmKey(settings);

  const outputDir = options.outputDir || settings.outputDir;
  const graph = options.graph || buildGraph(settings);
  const threadId = options.threadId || randomUUID();
  const state = initialState({
    species: settings.species,
    theme: settings.theme,
    autoApprove: settings.autoApprove,
    outputDir,
    mode,
    maxRetries: settings.maxRetries,
    injectCoderFailures: options.injectCoderFailures || 0,
  });

  const onEvent = options.onEvent;
  let result = await graph.invoke(state, { threadId, onEvent });

  while (result.__interrupt__) {
    const payload = result.__interrupt__;
    let decision;
    if (settings.autoApprove) decision = defaultDecision(payload);
    else if (options.humanHandler) {
      decision = normalizeDecision(await options.humanHandler(payload), payload);
    } else if (options.pauseOnInterrupt) {
      return { ...result, threadId, graph, settings, interrupted: true };
    } else {
      throw new Error("Pipeline interrupted and no human handler was provided. Pass autoApprove or humanHandler.");
    }
    result = await graph.invoke({ __resume: decision }, { threadId, onEvent });
  }

  writeJson(outputDir, "pipeline_log.json", {
    status: result.status,
    playable: result.playable,
    species: result.species,
    theme: result.theme,
    retries: result.retries,
    mode: result.mode,
    log: result.log,
    testReport: result.testReport,
  });
  return { ...result, threadId, outputDir: path.resolve(outputDir) };
}

export async function resumePipeline(graph, threadId, decision, { onEvent, outputDir, settings } = {}) {
  const result = await graph.invoke({ __resume: decision }, { threadId, onEvent });
  if (!result.__interrupt__ && outputDir) {
    writeJson(outputDir, "pipeline_log.json", {
      status: result.status,
      playable: result.playable,
      species: result.species,
      theme: result.theme,
      retries: result.retries,
      mode: result.mode,
      log: result.log,
      testReport: result.testReport,
    });
  }
  return result;
}
