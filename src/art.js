export const ASCII_ART = {
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

const PALETTES = {
  cat: { body: "#f4a261", stroke: "#9c5a1c", ear: "#e76f51", eye: "#2a2a2a" },
  dog: { body: "#e9c46a", stroke: "#7a4e12", ear: "#c28a2b", eye: "#2a2a2a" },
  bunny: { body: "#f1faee", stroke: "#9a8c98", ear: "#ffc2d4", eye: "#2a2a2a" },
  dragon: { body: "#2a9d8f", stroke: "#1d3557", ear: "#e9c46a", eye: "#e63946" },
};

export function svgFor(species, mood) {
  const palette = PALETTES[species] || PALETTES.cat;
  const { body, stroke, ear, eye } = palette;
  let eyes;
  let mouth;
  let extra = "";
  if (mood === "sleepy") {
    eyes = `<path d="M44 64 H60" stroke="${eye}" stroke-width="3" stroke-linecap="round"/>
      <path d="M68 64 H84" stroke="${eye}" stroke-width="3" stroke-linecap="round"/>`;
    mouth = `<path d="M56 78 Q64 82 72 78" fill="none" stroke="${stroke}" stroke-width="2"/>`;
    extra = `<text x="96" y="40" font-size="12" fill="#4a4a4a">zzz</text>`;
  } else if (mood === "sad") {
    eyes = `<circle cx="52" cy="64" r="4" fill="${eye}"/>
      <circle cx="76" cy="64" r="4" fill="${eye}"/>
      <path d="M50 58 L54 62" stroke="${stroke}" stroke-width="2"/>
      <path d="M78 58 L74 62" stroke="${stroke}" stroke-width="2"/>`;
    mouth = `<path d="M56 84 Q64 76 72 84" fill="none" stroke="${stroke}" stroke-width="2"/>`;
  } else if (mood === "hungry") {
    eyes = `<circle cx="52" cy="64" r="5" fill="${eye}"/>
      <circle cx="76" cy="64" r="5" fill="${eye}"/>`;
    mouth = `<ellipse cx="64" cy="84" rx="7" ry="6" fill="#3d1f14" stroke="${stroke}"/>`;
  } else if (mood === "play") {
    eyes = `<circle cx="52" cy="62" r="5" fill="${eye}"/>
      <circle cx="76" cy="62" r="5" fill="${eye}"/>
      <circle cx="53.5" cy="60.5" r="1.5" fill="#fff"/>
      <circle cx="77.5" cy="60.5" r="1.5" fill="#fff"/>`;
    mouth = `<path d="M54 80 Q64 92 74 80" fill="#3d1f14" stroke="${stroke}" stroke-width="1.5"/>`;
    extra = `<circle cx="104" cy="28" r="5" fill="${ear}" stroke="${stroke}"/>`;
  } else {
    eyes = `<circle cx="52" cy="64" r="4.5" fill="${eye}"/>
      <circle cx="76" cy="64" r="4.5" fill="${eye}"/>
      <circle cx="53.5" cy="62.5" r="1.4" fill="#fff"/>
      <circle cx="77.5" cy="62.5" r="1.4" fill="#fff"/>`;
    mouth = `<path d="M56 80 Q64 88 72 80" fill="none" stroke="${stroke}" stroke-width="2"/>`;
  }

  let ears;
  let tail = "";
  if (species === "dog") {
    ears = `<ellipse cx="36" cy="36" rx="12" ry="22" fill="${ear}" stroke="${stroke}" stroke-width="3" transform="rotate(-20 36 36)"/>
      <ellipse cx="92" cy="36" rx="12" ry="22" fill="${ear}" stroke="${stroke}" stroke-width="3" transform="rotate(20 92 36)"/>`;
    tail = `<path d="M100 90 Q122 70 112 44" fill="none" stroke="${stroke}" stroke-width="6"/>`;
  } else if (species === "bunny") {
    ears = `<ellipse cx="46" cy="22" rx="8" ry="26" fill="${ear}" stroke="${stroke}" stroke-width="3"/>
      <ellipse cx="82" cy="22" rx="8" ry="26" fill="${ear}" stroke="${stroke}" stroke-width="3"/>`;
    tail = `<circle cx="108" cy="96" r="8" fill="#fff" stroke="${stroke}" stroke-width="3"/>`;
  } else if (species === "dragon") {
    ears = `<path d="M34 48 L20 18 L50 40 Z" fill="${ear}" stroke="${stroke}" stroke-width="3"/>
      <path d="M94 48 L108 18 L78 40 Z" fill="${ear}" stroke="${stroke}" stroke-width="3"/>`;
    tail = `<path d="M100 92 Q126 86 118 50" fill="none" stroke="${stroke}" stroke-width="6"/>
      <path d="M118 50 L126 42 L114 44 Z" fill="${ear}" stroke="${stroke}" stroke-width="2"/>`;
  } else {
    ears = `<path d="M32 70 L28 22 L58 46 Z" fill="${ear}" stroke="${stroke}" stroke-width="3"/>
      <path d="M96 70 L100 22 L70 46 Z" fill="${ear}" stroke="${stroke}" stroke-width="3"/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="${species} ${mood}">
  <rect width="128" height="128" fill="#fff6e9"/>
  ${tail}
  ${ears}
  <circle cx="64" cy="72" r="36" fill="${body}" stroke="${stroke}" stroke-width="3"/>
  ${eyes}
  <ellipse cx="64" cy="74" rx="6" ry="4" fill="${ear}" stroke="${stroke}" stroke-width="1"/>
  ${mouth}
  ${extra}
</svg>
`;
}

export function mockArt(species) {
  const kind = species || "cat";
  const ascii = { ...(ASCII_ART[kind] || ASCII_ART.cat) };
  const svgs = {};
  for (const mood of Object.keys(ascii)) svgs[mood] = svgFor(kind, mood);
  return { ascii, svgs };
}
