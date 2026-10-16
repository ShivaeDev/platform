export function setupInstaller(pnpm: string, modules: string, quality: string, typecheckExit?: number) {
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
  fs.writeFileSync("pnpm-lock.yaml", "lockfileVersion: 9.0\\n");
  const modules = ${JSON.stringify(modules)};
  fs.mkdirSync("node_modules/.bin", { recursive: true });
  for (const name of fs.readdirSync(modules)) {
    if (name.startsWith("@")) {
      fs.mkdirSync(join("node_modules", name));
      for (const dependency of fs.readdirSync(join(modules, name))) {
        fs.symlinkSync(fs.realpathSync(join(modules, name, dependency)), join("node_modules", name, dependency));
      }
    } else if (name !== ".bin") {
      fs.symlinkSync(fs.realpathSync(join(modules, name)), join("node_modules", name));
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
