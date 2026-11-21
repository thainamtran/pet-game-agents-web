import assert from "node:assert/strict";
import test from "node:test";
import { defaultDesign, validateDesign } from "../src/design.js";
import { Pet, runScripted, SCRIPTED_COMMANDS } from "../src/game.js";
import { mockArt } from "../src/art.js";

test("default design is valid", () => {
  const design = defaultDesign("cat", "cozy backyard companion");
  assert.deepEqual(validateDesign(design), []);
  assert.equal(design.petNameDefault, "Mochi");
  assert.equal(design.title, "Little Companion");
});

test("pet starts with valid stats and art", () => {
  const design = defaultDesign("cat", "cozy backyard companion");
  const pet = new Pet({ design, ascii: mockArt("cat").ascii });
  assert.equal(pet.name, "Mochi");
  assert.ok(pet.hunger > 0 && pet.happiness > 0 && pet.energy > 0);
  assert.equal(pet.level, 1);
  assert.equal(pet.alive, true);
  assert.ok(pet.asciiArt());
});

test("feed increases fullness relative to waiting", () => {
  const design = defaultDesign("cat", "cozy");
  const fed = new Pet({ design });
  const before = fed.hunger;
  const after = fed.feed();
  const waited = new Pet({ design });
  waited.wait();
  assert.ok(after.hunger > waited.hunger);
  assert.ok(after.hunger >= before - 5);
});

test("play increases happiness relative to waiting", () => {
  const design = defaultDesign("dog", "yard");
  const played = new Pet({ design });
  const before = played.happiness;
  const after = played.play();
  const waited = new Pet({ design });
  waited.wait();
  assert.ok(after.happiness > waited.happiness);
  assert.ok(after.happiness >= before - 5);
});

test("sleep increases energy", () => {
  const design = defaultDesign("bunny", "garden");
  const pet = new Pet({ design });
  pet.energy = Math.min(pet.energy, 50);
  const before = pet.energy;
  assert.ok(pet.sleep().energy > before);
});

test("stats are clamped", () => {
  const design = defaultDesign("cat", "cozy");
  const pet = new Pet({ design });
  pet.hunger = 1000;
  pet.happiness = -50;
  pet._apply({ hunger: 0, happiness: 0 }, { tick: false, grantXp: false });
  assert.ok(pet.hunger <= 100);
  assert.ok(pet.happiness >= 0);
});

test("level up after enough care actions", () => {
  const design = defaultDesign("dragon", "tiny volcano");
  const pet = new Pet({ design });
  for (let i = 0; i < 6; i += 1) {
    pet.feed();
    pet.play();
    pet.sleep();
  }
  assert.ok(pet.level > 1);
  assert.equal(pet.alive, true);
});

test("scripted playthrough stays alive and progresses", () => {
  const design = defaultDesign("cat", "cozy backyard companion");
  const result = runScripted(SCRIPTED_COMMANDS, { design, ascii: mockArt("cat").ascii });
  assert.equal(result.alive, true);
  assert.ok(result.final.turn >= 8);
  assert.ok(result.final.level >= 2);
  assert.ok(result.final.hunger > 0);
  assert.ok(result.final.happiness > 0);
  assert.ok(result.final.energy > 0);
});
