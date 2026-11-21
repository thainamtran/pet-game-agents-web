import assert from "node:assert/strict";
import test from "node:test";
import { defaultDecision, normalizeDecision } from "../src/human.js";
import { extractJson } from "../src/llm.js";
import { getSettings, resolvedMode } from "../src/config.js";

const payload = {
  question: "What pet?",
  defaults: { species: "cat", theme: "cozy backyard companion" },
};

test("default decision uses payload defaults", () => {
  const decision = defaultDecision(payload);
  assert.equal(decision.species, "cat");
  assert.equal(decision.theme, "cozy backyard companion");
  assert.equal(decision.approved, true);
});

test("normalize pipe string", () => {
  const decision = normalizeDecision("dragon | tiny volcano", payload);
  assert.equal(decision.species, "dragon");
  assert.equal(decision.theme, "tiny volcano");
});

test("normalize yes keeps defaults", () => {
  assert.equal(normalizeDecision("yes", payload).species, "cat");
  assert.equal(normalizeDecision("", payload).theme, "cozy backyard companion");
});

test("normalize dict", () => {
  const decision = normalizeDecision({ species: "Bunny", theme: "garden tea party" }, payload);
  assert.equal(decision.species, "bunny");
  assert.equal(decision.theme, "garden tea party");
});

test("extract JSON from fenced and raw objects", () => {
  assert.deepEqual(extractJson('Sure.\n```json\n{"title":"Little Companion","ok":true}\n```\n'), {
    title: "Little Companion",
    ok: true,
  });
  assert.equal(extractJson('{"a":1}').a, 1);
});

test("auto mode without a key resolves to mock", () => {
  const previous = process.env.OPENAI_API_KEY;
  const previousMode = process.env.LLM_MODE;
  delete process.env.OPENAI_API_KEY;
  process.env.LLM_MODE = "auto";
  try {
    const settings = getSettings({ outputDir: "/tmp", autoApprove: true, mode: "auto" });
    settings.openaiApiKey = null;
    assert.equal(resolvedMode({ ...settings, mode: "auto", openaiApiKey: null }), "mock");
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
    if (previousMode === undefined) delete process.env.LLM_MODE;
    else process.env.LLM_MODE = previousMode;
  }
});
