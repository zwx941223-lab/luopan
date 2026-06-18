import fs from "node:fs";
import path from "node:path";

const srcDir = path.resolve("src");
const distDir = path.resolve("dist");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

function copyDirectory(source, target) {
  const entries = fs.readdirSync(source, { withFileTypes: true });
  fs.mkdirSync(target, { recursive: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

copyDirectory(srcDir, distDir);
