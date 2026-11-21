import fs from "node:fs";
import path from "node:path";

export function writeText(outputDir, relative, content) {
  const filePath = path.join(outputDir, relative);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

export function writeJson(outputDir, relative, data) {
  return writeText(outputDir, relative, `${JSON.stringify(data, null, 2)}\n`);
}
