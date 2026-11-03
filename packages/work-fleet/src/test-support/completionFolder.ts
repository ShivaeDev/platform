import { Effect, FileSystem } from "effect";

export const completionFolder = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "fleet-completion-" }));
	const source = "---\nid: one\nkind: task\nstatus: draft\nnext_action: Work\n---\nAuthored source.\n";
	yield* fs.makeDirectory(`${root}/tasks`);
	yield* fs.writeFileString(`${root}/tasks/one.md`, source);
	return { fs, root, source };
});
