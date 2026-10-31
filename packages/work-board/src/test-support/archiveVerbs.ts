import { execFile, execFileSync } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";
import { Effect } from "effect";
import { type BoardEngine, served } from "./storyEngine.ts";

export function archiveVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		archive: () => {
			tell("run work-board archive on the workspace");
			return Effect.sync(() =>
				execFileSync(process.execPath, ["--conditions=source", new URL("../server/cli.ts", import.meta.url).pathname, "archive", engine.notes.root], {
					encoding: "utf8",
				}),
			);
		},
		archiveConcurrently: () =>
			Effect.promise(async () => {
				tell("Board and Fleet archive the same workspace concurrently");
				await Promise.all(
					[1, 2].map(() =>
						promisify(execFile)(process.execPath, [
							"--conditions=source",
							new URL("../server/cli.ts", import.meta.url).pathname,
							"archive",
							engine.notes.root,
						]),
					),
				);
			}),
		readItem: (id: string) =>
			Effect.promise(() => {
				tell(`look up item ${id} through Board RPC`);
				const { client } = served(engine);
				return client.run(client.api.document.run({ url: `/_board/item/${id}/` }));
			}),
	};
}
