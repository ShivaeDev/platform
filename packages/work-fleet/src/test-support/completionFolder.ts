import { Effect, FileSystem } from "effect";

export const completionFolder = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "fleet-completion-" });
	const outside = yield* fs.makeTempDirectoryScoped({ prefix: "fleet-completion-outside-" });
	const source = "---\nid: one\nkind: task\nstatus: planned\nnext_action: Work\n---\nAuthored source.\n";
	yield* fs.makeDirectory(`${root}/tasks`);
	yield* fs.writeFileString(`${root}/tasks/one.md`, source);
	yield* fs.writeFileString(`${outside}/one.md`, source);
	return { fs, outside, root, source };
});
