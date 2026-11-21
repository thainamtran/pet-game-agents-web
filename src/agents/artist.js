import path from "node:path";
import { mockArt } from "../art.js";
import { writeJson, writeText } from "../files.js";
import { resolvedMode } from "../config.js";
import { LLMError, completeJson } from "../llm.js";

export async function artistNode(state, settings) {
  const species = (state.species || "cat").toLowerCase();
  const mode = state.mode || resolvedMode(settings);
  let ascii;
  let svgs;

  if (mode === "llm") {
    try {
      const data = await completeJson(settings, {
        system:
          'You are Artist. Return JSON { "ascii": {"happy","hungry","sleepy","sad","play"}, "svg": {same keys, complete 128x128 SVG} }. JSON only.',
        user: `Species: ${species}\nTheme: ${state.theme}\n`,
      });
      ascii = data?.ascii || {};
      svgs = data?.svg || data?.svgs || {};
      if (!ascii.happy) throw new LLMError("Artist returned no ASCII art");
    } catch (err) {
      const fallback = mockArt(species);
      ascii = fallback.ascii;
      svgs = fallback.svgs;
      const written = writeArt(state.outputDir, ascii, svgs);
      return {
        filesWritten: written,
        art: { ascii, svgs },
        log: [`artist: LLM failed (${err.message}); fell back to mock sprites`],
      };
    }
  } else {
    const art = mockArt(species);
    ascii = art.ascii;
    svgs = art.svgs;
  }

  const written = writeArt(state.outputDir, ascii, svgs);
  return {
    filesWritten: written,
    art: { ascii, svgs },
    log: [`artist: wrote ASCII + ${Object.keys(svgs).length} SVG sprite(s) for a ${species} in ${mode} mode`],
  };
}

function writeArt(outputDir, ascii, svgs) {
  const written = [writeJson(outputDir, path.join("sprites", "ascii.json"), ascii)];
  for (const [mood, svg] of Object.entries(svgs)) {
    written.push(writeText(outputDir, path.join("sprites", `pet_${mood}.svg`), svg));
  }
  return written;
}
