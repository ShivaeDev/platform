import { dirname } from "node:path";

export function setupInstaller(pnpm: string, modules: string, hoisted: string, quality: string, typecheckExit?: number) {
	// pnpm rebuilds the seeded install before a package script, so it must keep the workspace Quality engine.
	const qualityBin = `#!/usr/bin/env node
import("node:child_process").then(({ spawnSync }) => {
  const result = spawnSync(process.execPath, ["--conditions=source", ${JSON.stringify(quality)}, ...process.argv.slice(2)], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
});
`;
	return `#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { join } = require("node:path");
const args = process.argv.slice(2);
if (args[0] === "install") {
  const qualityRoot = ${JSON.stringify(dirname(dirname(quality)))};
  const qualityPackage = join(__dirname, "quality-package");
  fs.rmSync(qualityPackage, { recursive: true, force: true });
  fs.mkdirSync(qualityPackage, { recursive: true });
  for (const entry of fs.readdirSync(qualityRoot)) {
    if (entry !== "package.json") fs.symlinkSync(join(qualityRoot, entry), join(qualityPackage, entry));
  }
  const qualityManifest = JSON.parse(fs.readFileSync(join(qualityRoot, "package.json"), "utf8"));
  qualityManifest.bin = { quality: "./quality.js" };
  fs.writeFileSync(join(qualityPackage, "package.json"), JSON.stringify(qualityManifest));
  fs.writeFileSync(join(qualityPackage, "quality.js"), ${JSON.stringify(qualityBin)}, { mode: 0o755 });
  const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
  manifest.devDependencies["@shivaedev/quality"] = "link:" + qualityPackage;
  fs.writeFileSync("package.json", JSON.stringify(manifest, null, "\\t") + "\\n");
  fs.writeFileSync("pnpm-lock.yaml", "lockfileVersion: 9.0\\n");
  const modules = ${JSON.stringify(modules)};
  fs.rmSync("node_modules", { recursive: true, force: true });
  fs.mkdirSync("node_modules/.bin", { recursive: true });
  for (const name of fs.readdirSync(modules)) {
    if (name.startsWith("@")) {
      fs.mkdirSync(join("node_modules", name));
      for (const dependency of fs.readdirSync(join(modules, name))) {
        fs.symlinkSync(fs.realpathSync(join(modules, name, dependency)), join("node_modules", name, dependency));
      }
    } else if (!name.startsWith(".")) {
      fs.symlinkSync(fs.realpathSync(join(modules, name)), join("node_modules", name));
    }
  }
  const hoisted = ${JSON.stringify(hoisted)};
  for (const dependency of fs.readdirSync(hoisted)) {
    if (!fs.existsSync(join("node_modules/@shivaedev", dependency))) {
      fs.symlinkSync(fs.realpathSync(join(hoisted, dependency)), join("node_modules/@shivaedev", dependency));
    }
  }
  for (const name of fs.readdirSync(join(modules, ".bin"))) {
    if (name !== "quality") fs.symlinkSync(join(modules, ".bin", name), join("node_modules/.bin", name));
  }
  fs.writeFileSync("node_modules/.bin/quality", ${JSON.stringify(qualityBin)}, { mode: 0o755 });
  if (fs.existsSync(".git")) {
    fs.writeFileSync(".git/setup-order.json", JSON.stringify({
      head: spawnSync("git", ["rev-parse", "--verify", "HEAD"]).status,
      staged: spawnSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" }).stdout
    }));
  }
  process.exit(0);
}
if (args[0] === "run" && args[1] === "typecheck") {
  fs.writeFileSync(".git/initial-gate.json", JSON.stringify({
    staged: spawnSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" }).stdout
  }));
  process.exit(${typecheckExit ?? 0});
}
const result = spawnSync(${JSON.stringify(pnpm)}, args, { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
`;
}
