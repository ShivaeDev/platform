import { execFileSync } from "node:child_process";
import process from "node:process";
import type { BoardEngine } from "./storyEngine.ts";

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
	};
}
