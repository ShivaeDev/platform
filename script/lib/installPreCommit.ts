import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HOOK = "script/hooks/pre-commit";

// The hook runs the checked-out worktree's own script, so a branch that changes the checks commits under its own rules.
const SHIM = `#!/bin/sh\nexec "$(git rev-parse --show-toplevel)/${HOOK}" "$@"\n`;

export function installPreCommit(hooksDirectory: string): "installed" | "kept" {
	const file = join(hooksDirectory, "pre-commit");
	if (existsSync(file) && !readFileSync(file, "utf8").includes(HOOK)) {
		return "kept";
	}
	mkdirSync(hooksDirectory, { recursive: true });
	writeFileSync(file, SHIM);
	chmodSync(file, 0o755);
	return "installed";
}
