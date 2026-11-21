import fs from "node:fs";
import path from "node:path";
import { Pet, SCRIPTED_COMMANDS, runScripted } from "../game.js";

function categorize(issues) {
  const blob = issues.join(" ").toLowerCase();
  if (["sprite", "ascii", "svg", "art"].some((w) => blob.includes(w))) return "art";
  if (["design", "decay", "balance", "too harsh", "unbalanced"].some((w) => blob.includes(w))) {
    return "design";
  }
  return "code";
}

function runUnitChecks(design, ascii) {
  const issues = [];
  const pet = new Pet({ design, ascii });
  if (!pet.name || !pet.species) issues.push("pet is missing name or species");
  if (!(pet.hunger > 0 && pet.happiness > 0 && pet.energy > 0)) {
    issues.push("starting stats must be above zero");
  }
  if (!pet.asciiArt()) issues.push("ascii art is missing");

  const fed = new Pet({ design, ascii });
  const beforeHunger = fed.hunger;
  const afterFeed = fed.feed();
  const waited = new Pet({ design, ascii });
  waited.wait();
  if (!(afterFeed.hunger > waited.hunger) || afterFeed.hunger < beforeHunger - 5) {
    issues.push("feed did not increase fullness relative to waiting");
  }

  const played = new Pet({ design, ascii });
  const beforeHappy = played.happiness;
  const afterPlay = played.play();
  const waitedH = new Pet({ design, ascii });
  waitedH.wait();
  if (!(afterPlay.happiness > waitedH.happiness) || afterPlay.happiness < beforeHappy - 5) {
    issues.push("play did not increase happiness relative to waiting");
  }

  const sleeper = new Pet({ design, ascii });
  sleeper.energy = Math.min(sleeper.energy, 50);
  const beforeEnergy = sleeper.energy;
  if (!(sleeper.sleep().energy > beforeEnergy)) issues.push("sleep did not increase energy");

  const leveler = new Pet({ design, ascii });
  const startLevel = leveler.level;
  for (let i = 0; i < 6; i += 1) {
    leveler.feed();
    leveler.play();
    leveler.sleep();
  }
  if (!(leveler.level > startLevel) || !leveler.alive) {
    issues.push("pet did not level up after a care loop — balance/XP issue");
  }
  return issues;
}

export function testerNode(state) {
  const outputDir = state.outputDir;
  const issues = [];
  const bundlePath = path.join(outputDir, "game-bundle.json");
  const asciiPath = path.join(outputDir, "sprites", "ascii.json");
  let scripted = {};
  let unitIssues = [];

  if (!fs.existsSync(bundlePath)) issues.push("game-bundle.json is missing");
  if (!fs.existsSync(asciiPath)) issues.push("ASCII sprite sheet is missing");
  const spritesDir = path.join(outputDir, "sprites");
  const svgFiles = fs.existsSync(spritesDir)
    ? fs.readdirSync(spritesDir).filter((name) => name.endsWith(".svg"))
    : [];
  if (svgFiles.length < 3) issues.push("Expected at least 3 SVG sprites");

  let bundle = state.bundle;
  if (!bundle && fs.existsSync(bundlePath)) {
    try {
      bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
    } catch (err) {
      issues.push(`game-bundle.json is not valid JSON: ${err.message}`);
    }
  }
  if (bundle?.broken) issues.push("game bundle is marked broken (missing playability hooks)");

  const design = bundle?.design || state.design;
  let ascii;
  if (fs.existsSync(asciiPath)) {
    try {
      ascii = JSON.parse(fs.readFileSync(asciiPath, "utf8"));
    } catch (err) {
      issues.push(`ascii.json is not valid JSON: ${err.message}`);
    }
  }

  if (design && !bundle?.broken) {
    try {
      unitIssues = runUnitChecks(design, ascii);
      issues.push(...unitIssues);
      const result = runScripted(SCRIPTED_COMMANDS, { design, ascii, name: design.petNameDefault });
      scripted = result;
      const final = result.final || {};
      if (!result.alive) issues.push("scripted playthrough died — design may be too harsh");
      if (Number(final.level || 0) < 2) {
        issues.push("scripted playthrough did not reach level 2 — balance/XP issue");
      }
      for (const stat of ["hunger", "happiness", "energy"]) {
        if (Number(final[stat] || 0) <= 0) issues.push(`scripted playthrough ended with ${stat} <= 0`);
      }
    } catch (err) {
      issues.push(`playability checks failed: ${err.message}`);
    }
  } else if (!design) {
    issues.push("no design available to test");
  }

  const unique = [...new Set(issues)];
  const passed = unique.length === 0;
  const category = passed ? "code" : categorize(unique);
  const report = {
    passed,
    playable: passed,
    category,
    summary: passed ? "All playability checks passed." : unique.join("; "),
    issues: unique,
    scriptedResult: scripted.final ? { final: scripted.final, alive: scripted.alive } : {},
  };
  return {
    testReport: report,
    playable: passed,
    failureCategory: passed ? null : category,
    log: [`tester: ${passed ? "PASS" : "FAIL"} — ${report.summary}`],
  };
}
