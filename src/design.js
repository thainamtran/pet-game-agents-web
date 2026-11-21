export const REQUIRED_STATS = ["hunger", "happiness", "energy"];
export const REQUIRED_ACTIONS = ["feed", "play", "sleep"];

export function defaultDesign(species, theme) {
  const kind = (species || "cat").trim().toLowerCase() || "cat";
  const names = { cat: "Mochi", dog: "Biscuit", bunny: "Bông", dragon: "Ember" };
  const titles = {
    cat: "Little Companion",
    dog: "Yard Buddy",
    bunny: "Garden Friend",
    dragon: "Tiny Ember",
  };
  return {
    title: titles[kind] || "Little Companion",
    theme: theme || "cozy backyard companion",
    species: kind,
    petNameDefault: names[kind] || "Mochi",
    stats: {
      hunger: { min: 0, max: 100, start: 70, decayPerTurn: 8 },
      happiness: { min: 0, max: 100, start: 72, decayPerTurn: 5 },
      energy: { min: 0, max: 100, start: 80, decayPerTurn: 4 },
    },
    leveling: { xpPerAction: 10, xpToLevel: 30, maxLevel: 5 },
    actions: [
      { id: "feed", label: "Feed", effects: { hunger: 32, energy: 4, happiness: 6 } },
      { id: "play", label: "Play", effects: { happiness: 26, energy: -16, hunger: -8 } },
      { id: "sleep", label: "Sleep", effects: { energy: 38, hunger: -6, happiness: 6 } },
    ],
    notes:
      "Hunger is a fullness meter: 100 is well fed, 0 is starving. Every action advances a turn and applies idle decay.",
  };
}

export function validateDesign(design) {
  const issues = [];
  if (!design || !design.species) issues.push("design is missing species");
  const stats = design?.stats || {};
  for (const name of REQUIRED_STATS) {
    const spec = stats[name];
    if (!spec || typeof spec !== "object") {
      issues.push(`design.stats.${name} is missing`);
      continue;
    }
    for (const key of ["min", "max", "start", "decayPerTurn"]) {
      if (spec[key] === undefined && spec.decay_per_turn === undefined && key === "decayPerTurn") {
        issues.push(`design.stats.${name}.${key} is missing`);
      } else if (key !== "decayPerTurn" && spec[key] === undefined) {
        issues.push(`design.stats.${name}.${key} is missing`);
      }
    }
  }
  const ids = new Set((design?.actions || []).map((a) => a && a.id));
  for (const id of REQUIRED_ACTIONS) {
    if (!ids.has(id)) issues.push(`design.actions is missing ${id}`);
  }
  const leveling = design?.leveling || {};
  for (const key of ["xpPerAction", "xpToLevel", "maxLevel"]) {
    const snake = key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
    if (leveling[key] === undefined && leveling[snake] === undefined) {
      issues.push(`design.leveling.${key} is missing`);
    }
  }
  return issues;
}

/** Accept snake_case (Python original) or camelCase. */
export function normalizeDesign(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const stats = {};
  for (const [name, spec] of Object.entries(raw.stats || {})) {
    stats[name] = {
      min: Number(spec.min ?? 0),
      max: Number(spec.max ?? 100),
      start: Number(spec.start ?? 70),
      decayPerTurn: Number(spec.decayPerTurn ?? spec.decay_per_turn ?? 6),
    };
  }
  const leveling = raw.leveling || {};
  return {
    ...raw,
    petNameDefault: raw.petNameDefault || raw.pet_name_default || "Mochi",
    stats,
    leveling: {
      xpPerAction: Number(leveling.xpPerAction ?? leveling.xp_per_action ?? 10),
      xpToLevel: Number(leveling.xpToLevel ?? leveling.xp_to_level ?? 30),
      maxLevel: Number(leveling.maxLevel ?? leveling.max_level ?? 5),
    },
    actions: Array.isArray(raw.actions) ? raw.actions : [],
  };
}
