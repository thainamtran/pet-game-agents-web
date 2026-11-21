import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getSettings } from "../src/config.js";
import { buildGraph, initialState } from "../src/graph.js";
import { runPipeline } from "../src/pipeline.js";
import { routeAfterManager } from "../src/agents/manager.js";

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("mock pipeline end to end produces a playable game", async () => {
  const outputDir = tmpDir("pet-web-e2e-");
  const result = await runPipeline({
    mode: "mock",
    autoApprove: true,
    species: "cat",
    theme: "cozy backyard companion",
    outputDir,
    maxRetries: 2,
  });
  assert.equal(result.playable, true);
  assert.equal(result.status, "playable");
  assert.equal(result.retries, 0);
  assert.equal(result.species, "cat");
  assert.ok(fs.existsSync(path.join(outputDir, "game-bundle.json")));
  assert.ok(fs.existsSync(path.join(outputDir, "design.json")));
  assert.ok(fs.existsSync(path.join(outputDir, "sprites", "ascii.json")));
  const svgs = fs.readdirSync(path.join(outputDir, "sprites")).filter((n) => n.endsWith(".svg"));
  assert.ok(svgs.length >= 4);
  const log = result.log.join("\n");
  assert.match(log, /designer:/);
  assert.match(log, /coder:/);
  assert.match(log, /artist:/);
  assert.match(log, /tester: PASS/);
  assert.match(log, /manager:/);
});

test("retry on injected coder failure then becomes playable", async () => {
  const outputDir = tmpDir("pet-web-retry-");
  const result = await runPipeline({
    mode: "mock",
    autoApprove: true,
    species: "bunny",
    theme: "garden tea party",
    outputDir,
    maxRetries: 3,
    injectCoderFailures: 1,
  });
  assert.equal(result.playable, true);
  assert.equal(result.status, "playable");
  assert.equal(result.retries, 1);
  assert.equal(result.species, "bunny");
  const log = result.log.join("\n");
  assert.match(log, /injected a broken build/);
  assert.match(log, /retry 1\/3 via coder/);
  assert.match(log, /tester: PASS/);
});

test("interrupt then resume with a human decision", async () => {
  const outputDir = tmpDir("pet-web-hitl-");
  const settings = getSettings({
    mode: "mock",
    autoApprove: false,
    species: "cat",
    theme: "cozy backyard companion",
    outputDir,
    maxRetries: 2,
  });
  const graph = buildGraph(settings);
  const paused = await graph.invoke(
    initialState({
      species: "cat",
      theme: "cozy backyard companion",
      autoApprove: false,
      outputDir,
      mode: "mock",
      maxRetries: 2,
    }),
    { threadId: "test-human" },
  );
  assert.ok(paused.__interrupt__, "expected a human-in-the-loop interrupt");
  assert.equal(paused.__interrupt__.type, "major_decision");

  const result = await graph.invoke(
    { __resume: { species: "dragon", theme: "tiny volcano hatchling" } },
    { threadId: "test-human" },
  );
  assert.equal(result.__interrupt__, undefined);
  assert.equal(result.playable, true);
  assert.equal(result.species, "dragon");
  assert.equal(result.theme, "tiny volcano hatchling");
  const design = JSON.parse(fs.readFileSync(path.join(outputDir, "design.json"), "utf8"));
  assert.equal(design.species, "dragon");
  assert.match(result.log.join("\n"), /intake: human chose/);
});

test("humanHandler callback is used when auto-approve is off", async () => {
  const outputDir = tmpDir("pet-web-cb-");
  const seen = {};
  const result = await runPipeline({
    mode: "mock",
    autoApprove: false,
    outputDir,
    humanHandler: (payload) => {
      seen.payload = payload;
      return "dog | rainy-day rescue";
    },
  });
  assert.equal(seen.payload.type, "major_decision");
  assert.equal(result.species, "dog");
  assert.equal(result.theme, "rainy-day rescue");
  assert.equal(result.playable, true);
});

test("manager gives up after max retries", async () => {
  const outputDir = tmpDir("pet-web-fail-");
  const result = await runPipeline({
    mode: "mock",
    autoApprove: true,
    species: "cat",
    theme: "cozy backyard companion",
    outputDir,
    maxRetries: 1,
    injectCoderFailures: 5,
  });
  assert.equal(result.playable, false);
  assert.equal(result.status, "failed");
  assert.ok(result.retries >= 1);
  assert.match(result.log.join("\n"), /giving up/);
});

test("manager routes design failures back to the designer", () => {
  assert.equal(routeAfterManager({ playable: true, status: "playable" }), "done");
  assert.equal(routeAfterManager({ playable: false, status: "failed" }), "done");
  assert.equal(routeAfterManager({ playable: false, status: "running", failureCategory: "design" }), "design");
  assert.equal(routeAfterManager({ playable: false, status: "running", failureCategory: "code" }), "code");
});
