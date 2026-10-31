import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { Effect, FileSystem } from "effect";
import { vi } from "vitest";
import * as publication from "@shivaedev/work-board/server/responses/publicationDirectory.ts";

export const completionFolder = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "fleet-completion-" }));
	const outside = yield* fs.makeTempDirectoryScoped({ prefix: "fleet-completion-outside-" });
	const source = "---\nid: one\nkind: task\nstatus: draft\nnext_action: Work\n---\nAuthored source.\n";
	yield* fs.makeDirectory(`${root}/tasks`);
	yield* fs.writeFileString(`${root}/tasks/one.md`, source);
	yield* fs.writeFileString(`${outside}/one.md`, source);
	return { fs, outside, root, source };
});

// The second validation of the tasks folder runs after the replacement file is prepared and before it is renamed into place.
export const editWhileReplacing = Effect.fn("CompletionStory.editWhileReplacing")(function* (root: string, changed: string) {
	const validate = publication.validateDirectory;
	const seen: { source: string; temporaryFiles: number }[] = [];
	const spy = vi.spyOn(publication, "validateDirectory").mockImplementation(async (...args) => {
		await validate(...args);
		if (args[2] !== `${root}/tasks`) {
			return;
		}
		if (seen.length === 1) {
			seen.push({
				source: readFileSync(`${root}/tasks/one.md`, "utf8"),
				temporaryFiles: readdirSync(`${root}/tasks`).filter((file) => file.endsWith(".tmp")).length,
			});
			writeFileSync(`${root}/tasks/one.md`, changed);
			return;
		}
		seen.push({ source: "", temporaryFiles: 0 });
	});
	yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
	return { beforeEdit: () => Effect.sync(() => seen[1]) };
});
