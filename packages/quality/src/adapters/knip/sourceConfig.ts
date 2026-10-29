import { join, posix, resolve } from "node:path";
import { Effect, FileSystem } from "effect";
import type { RuleInputs } from "#rule.ts";

export const sourceConfig = Effect.fn("Knip.sourceConfig")(function* (inputs: RuleInputs, directories: readonly string[], id: string) {
	const fs = yield* FileSystem.FileSystem;
	const relative = posix.join("node_modules", ".cache", "quality", id, "tsconfig.json");
	for (const directory of directories) {
		const folder = join(inputs.root, directory, "node_modules", ".cache", "quality", id);
		yield* fs.makeDirectory(folder, { recursive: true });
		yield* Effect.addFinalizer(() => fs.remove(folder, { recursive: true }).pipe(Effect.orDie));
		const parents = yield* Effect.forEach(["tsconfig.json", "tsconfig.build.json"], (file) =>
			Effect.promise(() => inputs.readText(posix.join(directory, file))).pipe(
				Effect.map((text) => (text === undefined ? [] : [resolve(inputs.root, directory, file)])),
			),
		);
		yield* fs.writeFileString(join(folder, "tsconfig.json"), JSON.stringify({ extends: parents.flat(), files: [] }));
	}
	return relative;
});
