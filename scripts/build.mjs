// Builds the Chrome and Firefox packages from the shared src/ tree.
//
// For each target: copy src/ to dist/<target>/ (minus the manifest parts),
// deep-merge manifest.base.json with the per-browser overlay, inject the
// version from package.json, then zip with web-ext.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");
const artifactsDir = path.join(root, "web-ext-artifacts");

const TARGETS = ["chrome", "firefox"];
const MANIFEST_FILES = ["manifest.base.json", "manifest.chrome.json", "manifest.firefox.json"];

function deepMerge(base, overlay) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const baseManifest = JSON.parse(fs.readFileSync(path.join(srcDir, "manifest.base.json"), "utf8"));

fs.rmSync(distDir, { recursive: true, force: true });
fs.rmSync(artifactsDir, { recursive: true, force: true });

for (const target of TARGETS) {
  const targetDir = path.join(distDir, target);

  fs.cpSync(srcDir, targetDir, {
    recursive: true,
    filter: (source) => !MANIFEST_FILES.includes(path.basename(source)),
  });

  const overlay = JSON.parse(fs.readFileSync(path.join(srcDir, `manifest.${target}.json`), "utf8"));
  const manifest = { ...deepMerge(baseManifest, overlay), version };
  fs.writeFileSync(path.join(targetDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  execFileSync(
    "npx",
    [
      "web-ext",
      "build",
      "--source-dir",
      targetDir,
      "--artifacts-dir",
      artifactsDir,
      "--overwrite-dest",
      "--filename",
      `olorin-${target}-${version}.zip`,
    ],
    { cwd: root, stdio: "inherit" },
  );
}

console.log(`\nBuilt version ${version}:`);
for (const target of TARGETS) {
  console.log(`  dist/${target}/ and web-ext-artifacts/olorin-${target}-${version}.zip`);
}
