export function defaultDecision(payload = {}) {
  const defaults = payload.defaults || {};
  return {
    species: String(defaults.species || "cat").trim().toLowerCase() || "cat",
    theme: String(defaults.theme || "cozy backyard companion").trim() || "cozy backyard companion",
    approved: true,
  };
}

export function normalizeDecision(raw, payload = {}) {
  const defaults = defaultDecision(payload);
  if (raw == null || raw === true || raw === "") return defaults;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (["y", "yes", "ok", "okay", "default", "defaults"].includes(text.toLowerCase())) {
      return defaults;
    }
    let species;
    let theme;
    if (text.includes("|")) {
      const idx = text.indexOf("|");
      species = text.slice(0, idx);
      theme = text.slice(idx + 1);
    } else if (text.includes(",")) {
      const idx = text.indexOf(",");
      species = text.slice(0, idx);
      theme = text.slice(idx + 1);
    } else {
      species = text;
      theme = defaults.theme;
    }
    return {
      species: species.trim().toLowerCase() || defaults.species,
      theme: theme.trim() || defaults.theme,
      approved: true,
    };
  }
  if (typeof raw === "object") {
    return {
      species: String(raw.species || defaults.species).trim().toLowerCase(),
      theme: String(raw.theme || defaults.theme).trim(),
      approved: raw.approved !== false,
    };
  }
  return defaults;
}

export function intakePayload(state) {
  return {
    type: "major_decision",
    question: "What pet should we raise, and what is the game's theme?",
    details:
      "Agents will invent the rest of the gameplay (stats, actions, art, tests). Only this kind of major choice is sent to you.",
    defaults: {
      species: state.species || "cat",
      theme: state.theme || "cozy backyard companion",
    },
  };
}

export class InterruptSignal {
  constructor(value) {
    this.value = value;
    this.name = "InterruptSignal";
  }
}

export function interrupt(value) {
  throw new InterruptSignal(value);
}

export function intakeNode(state) {
  const payload = intakePayload(state);
  if (state.autoApprove) {
    const decision = defaultDecision(payload);
    return {
      species: decision.species,
      theme: decision.theme,
      log: [`intake: auto-approved species='${decision.species}' theme='${decision.theme}'`],
    };
  }
  if (state.__resume !== undefined && state.__resume !== null) {
    const decision = normalizeDecision(state.__resume, payload);
    return {
      species: decision.species,
      theme: decision.theme,
      log: [`intake: human chose species='${decision.species}' theme='${decision.theme}'`],
    };
  }
  interrupt(payload);
}
