export function setupInstaller(pnpm: string, modules: string, typecheckExit?: number) {
	return `#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "install") {
  fs.writeFileSync("pnpm-lock.yaml", "lockfileVersion: 9.0\\n");
  fs.symlinkSync(${JSON.stringify(modules)}, "node_modules", "dir");
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
  ${typecheckExit === undefined ? "" : `process.exit(${typecheckExit});`}
}
const result = spawnSync(${JSON.stringify(pnpm)}, args, { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
`;
}
