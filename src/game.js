/**
 * Little Companion — cozy pet-raising game logic (game nuôi thú).
 * Works in Node and in the browser. Pass a design (and optional ASCII art).
 */

export function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

export const FALLBACK_ASCII = {
  cat: {
    happy: "  /\\_/\\\n ( ^.^ )\n  > ^ <",
    hungry: "  /\\_/\\\n ( o.o )\n  > ~ <",
    sleepy: "  /\\_/\\\n ( -.- )\n  > ^ <  zzz",
    sad: "  /\\_/\\\n ( ;_; )\n  > ^ <",
    play: "  /\\_/\\\n ( ^o^ )\n  /   \\  *",
  },
  dog: {
    happy: "  / \\__\n (  ^.^)\n /  -- \\",
    hungry: "  / \\__\n (  o.o)\n /  -- \\",
    sleepy: "  / \\__\n (  -.-) zzz\n /  -- \\",
    sad: "  / \\__\n (  ;_;)\n /  -- \\",
    play: "  / \\__\n (  ^o^)  woof!\n /  -- \\",
  },
  bunny: {
    happy: "  (\\_/)\n  ( ^.^)\n  (___)",
    hungry: "  (\\_/)\n  ( o.o)\n  (___)",
    sleepy: "  (\\_/)\n  ( -.-) zzz\n  (___)",
    sad: "  (\\_/)\n  ( ;_;)\n  (___)",
    play: "  (\\_/)\n  ( ^o^)  hop!\n  (___)",
  },
  dragon: {
    happy: "    /\\   /\\\n   (  ^.^  )\n  <        >~~\n    /    \\",
    hungry: "    /\\   /\\\n   (  o.o  )\n  <        >~~\n    /    \\",
    sleepy: "    /\\   /\\\n   (  -.-  ) zzz\n  <        >~~\n    /    \\",
    sad: "    /\\   /\\\n   (  ;_;  )\n  <        >~~\n    /    \\",
    play: "    /\\   /\\\n   (  ^o^  )\n  <        >~~ *\n    /    \\",
  },
};

function statSpec(design, name, fallbackStart, fallbackDecay) {
  const spec = (design?.stats && design.stats[name]) || {};
  return {
    min: Number(spec.min ?? 0),
    max: Number(spec.max ?? 100),
    start: Number(spec.start ?? fallbackStart),
    decayPerTurn: Number(spec.decayPerTurn ?? spec.decay_per_turn ?? fallbackDecay),
  };
}

function defaultActions() {
  return [
    { id: "feed", label: "Feed", effects: { hunger: 30, energy: 5, happiness: 5 } },
    { id: "play", label: "Play", effects: { happiness: 25, energy: -20, hunger: -10 } },
    { id: "sleep", label: "Sleep", effects: { energy: 40, hunger: -8, happiness: 5 } },
  ];
}

function actionById(design, id) {
  const actions = Array.isArray(design?.actions) && design.actions.length ? design.actions : defaultActions();
  return actions.find((a) => a && a.id === id) || null;
}

export class Pet {
  constructor({ name, species, design, ascii } = {}) {
    this.design = design || {};
    const leveling = this.design.leveling || {};
    this.species = species || this.design.species || "cat";
    this.name = name || this.design.petNameDefault || this.design.pet_name_default || "Mochi";
    this.theme = this.design.theme || "cozy companion";
    this.title = this.design.title || "Little Companion";

    const hunger = statSpec(this.design, "hunger", 70, 8);
    const happiness = statSpec(this.design, "happiness", 72, 5);
    const energy = statSpec(this.design, "energy", 80, 4);
    this._bounds = {
      hunger: [hunger.min, hunger.max],
      happiness: [happiness.min, happiness.max],
      energy: [energy.min, energy.max],
    };
    this._decay = {
      hunger: hunger.decayPerTurn,
      happiness: happiness.decayPerTurn,
      energy: energy.decayPerTurn,
    };
    this.hunger = hunger.start;
    this.happiness = happiness.start;
    this.energy = energy.start;
    this.level = 1;
    this.xp = 0;
    this.xpPerAction = Number(leveling.xpPerAction ?? leveling.xp_per_action ?? 10);
    this.xpToLevel = Number(leveling.xpToLevel ?? leveling.xp_to_level ?? 30);
    this.maxLevel = Number(leveling.maxLevel ?? leveling.max_level ?? 5);
    this.turn = 0;
    this.alive = true;
    this.logs = [`${this.name} the ${this.species} arrives, ready to be cared for.`];
    this._ascii = ascii || FALLBACK_ASCII[this.species] || FALLBACK_ASCII.cat;
  }

  snapshot() {
    return {
      name: this.name,
      species: this.species,
      hunger: this.hunger,
      happiness: this.happiness,
      energy: this.energy,
      level: this.level,
      xp: this.xp,
      xpToLevel: this.xpToLevel,
      maxLevel: this.maxLevel,
      turn: this.turn,
      alive: this.alive,
      mood: this.mood(),
      title: this.title,
      theme: this.theme,
    };
  }

  _apply(effects, { tick = true, grantXp = true } = {}) {
    if (!this.alive) return this.snapshot();
    for (const [stat, delta] of Object.entries(effects || {})) {
      if (this._bounds[stat]) {
        const [lo, hi] = this._bounds[stat];
        this[stat] = clamp(this[stat] + Number(delta), lo, hi);
      }
    }
    if (grantXp) this._gainXp(this.xpPerAction);
    if (tick) this.tick();
    return this.snapshot();
  }

  _gainXp(amount) {
    if (this.level >= this.maxLevel) return;
    this.xp += amount;
    while (this.xp >= this.xpToLevel && this.level < this.maxLevel) {
      this.xp -= this.xpToLevel;
      this.level += 1;
      this.logs.push(`${this.name} reached level ${this.level}!`);
      const [lo, hi] = this._bounds.happiness;
      this.happiness = clamp(this.happiness + 10, lo, hi);
    }
  }

  feed() {
    const action = actionById(this.design, "feed");
    const effects = { ...(action?.effects || { hunger: 30, energy: 5, happiness: 5 }) };
    this.logs.push(`You feed ${this.name}. The bowl is empty; the belly is not.`);
    return this._apply(effects);
  }

  play() {
    if (this.energy < 10) {
      this.logs.push(`${this.name} is too tired to play. A nap might help.`);
      return this.snapshot();
    }
    const action = actionById(this.design, "play");
    const effects = { ...(action?.effects || { happiness: 25, energy: -20, hunger: -10 }) };
    this.logs.push(`You play with ${this.name}. Joy goes up; energy goes down.`);
    return this._apply(effects);
  }

  sleep() {
    const action = actionById(this.design, "sleep");
    const effects = { ...(action?.effects || { energy: 40, hunger: -8, happiness: 5 }) };
    this.logs.push(`${this.name} curls up and sleeps. Energy returns.`);
    return this._apply(effects);
  }

  wait() {
    this.logs.push("A quiet moment passes.");
    if (!this.alive) return this.snapshot();
    this.tick();
    return this.snapshot();
  }

  tick() {
    this.turn += 1;
    for (const [stat, decay] of Object.entries(this._decay)) {
      const [lo, hi] = this._bounds[stat];
      this[stat] = clamp(this[stat] - decay, lo, hi);
    }
    if (this.hunger <= 0 || this.happiness <= 0 || this.energy <= 0) {
      this.alive = false;
      this.logs.push(
        `Oh no — ${this.name} needs more care. One of the stats reached zero. Game over.`,
      );
    }
  }

  mood() {
    if (!this.alive) return "sad";
    if (this.energy <= 25) return "sleepy";
    if (this.hunger <= 25) return "hungry";
    if (this.happiness <= 25) return "sad";
    if (this.happiness >= 70 && this.energy >= 40) return this.happiness >= 85 ? "play" : "happy";
    return "happy";
  }

  asciiArt() {
    const mood = this.mood();
    return this._ascii[mood] || this._ascii.happy || "(?:)";
  }

  bar(value, stat = "hunger") {
    const [lo, hi] = this._bounds[stat] || [0, 100];
    const width = 10;
    const span = Math.max(hi - lo, 1);
    const filled = clamp(Math.round(((value - lo) / span) * width), 0, width);
    return `[${"#".repeat(filled)}${".".repeat(width - filled)}]  ${value}`;
  }

  statusText() {
    const lines = [
      this.asciiArt(),
      "",
      ` ${this.name} the ${this.species}    Level ${this.level} (${this.xp}/${this.xpToLevel} XP)`,
      ` Hunger    ${this.bar(this.hunger, "hunger")}`,
      ` Happiness ${this.bar(this.happiness, "happiness")}`,
      ` Energy    ${this.bar(this.energy, "energy")}`,
      ` Mood: ${this.mood()}    Turn: ${this.turn}`,
    ];
    if (!this.alive) lines.push(" Status: needs a fresh start (game over)");
    return lines.join("\n");
  }
}

export function runScripted(commands, options = {}) {
  const pet = new Pet(options);
  const history = [pet.snapshot()];
  for (const raw of commands || []) {
    const cmd = String(raw).trim().toLowerCase();
    if (cmd === "f" || cmd === "feed") history.push(pet.feed());
    else if (cmd === "p" || cmd === "play") history.push(pet.play());
    else if (cmd === "s" || cmd === "sleep") history.push(pet.sleep());
    else if (cmd === "w" || cmd === "wait" || cmd === "t" || cmd === "tick") history.push(pet.wait());
    else if (cmd === "q" || cmd === "quit") break;
    else if (cmd === "status" || cmd === "st") history.push(pet.snapshot());
    else pet.logs.push(`Unknown command: ${raw}`);
  }
  return { final: pet.snapshot(), history, logs: [...pet.logs], alive: pet.alive };
}

export const SCRIPTED_COMMANDS = [
  "feed",
  "play",
  "sleep",
  "feed",
  "play",
  "sleep",
  "feed",
  "sleep",
];
