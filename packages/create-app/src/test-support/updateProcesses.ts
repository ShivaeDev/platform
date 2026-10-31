import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function updateTypecheck(starter: string) {
	const compiler = fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url));
	writeFileSync(join(starter, "update-check.ts"), "export const address: string = 'localhost';\n\n\n\n\n\n\n\n\n\nexport const port = 3000;\n");
	writeFileSync(join(starter, "tsconfig.update.json"), JSON.stringify({ compilerOptions: { noEmit: true, types: [] }, files: ["update-check.ts"] }));
	return `node '${compiler.replaceAll("'", "'\"'\"'")}' --project tsconfig.update.json`;
}

// Installation is external; the app's typecheck script runs with the real compiler.
export function updateProcesses(root: string, installationError: string) {
	const pnpm = spawnSync("which", ["pnpm"], { encoding: "utf8" }).stdout.trim();
	writeFileSync(
		join(root, "bin/pnpm"),
		`#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const args = process.argv.slice(2);
if (args[0] === "install") {
  console.error(${JSON.stringify(installationError)});
  process.exit(${installationError === "" ? 0 : 1});
}
const result = spawnSync(${JSON.stringify(pnpm)}, args, { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
`,
		{ mode: 0o755 },
	);
}
