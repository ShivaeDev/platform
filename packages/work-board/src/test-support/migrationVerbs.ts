import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";
import type { BoardEngine } from "#test/storyEngine.ts";

export function migrationVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		migrate: () => {
			tell("run work-board migrate on the Board directory");
			return execFileSync(
				process.execPath,
				["--conditions=source", new URL("../server/cli.ts", import.meta.url).pathname, "migrate", engine.notes.root],
				{ encoding: "utf8" },
			);
		},
		tryMigration: () => {
			tell("run work-board migrate and read its exit status and diagnostics");
			return spawnSync(
				process.execPath,
				["--conditions=source", new URL("../server/cli.ts", import.meta.url).pathname, "migrate", engine.notes.root],
				{ encoding: "utf8" },
			);
		},
	};
}
