import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { command } from "#package-check/io.ts";
import { runStarter } from "./run.ts";

export const withoutExample = Effect.fn("Published.withoutExample")(function* (directory: string, database: string) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.remove(join(directory, "src/modules/notes"), { recursive: true });
	for (const [path, registration] of [
		["src/server/modules.ts", "notesRegistration"],
		["src/server/workerModules.ts", "notesWorker"],
		["src/client/modules.ts", "notesRegistration"],
		["src/server/migrations.ts", "notesMigrations"],
	] as const) {
		const target = join(directory, path);
		const source = yield* fs.readFileString(target);
		const withoutImport = source.replace(/^import .* from "#modules\/notes\/.*";\n/gmu, "");
		yield* fs.writeFileString(target, withoutImport.replace(new RegExp(`\\b${registration}\\b,?`, "gu"), ""));
	}
	yield* command(directory, "pnpm", ["format"]);
	yield* Effect.log("Generated app without the example: pnpm ready");
	yield* runStarter(directory, database, "ready");
});
