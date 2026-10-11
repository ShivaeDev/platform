import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { attempt } from "./attempt.ts";
import { collectFragments } from "./fragments.ts";
import { readPackage } from "./package.ts";

export const releasePackage = Effect.fn("Changelog.releasePackage")(function* (directory: string, date: string) {
	const fs = yield* FileSystem.FileSystem;
	const notes = yield* readPackage(directory);
	const changelog = yield* attempt(() => collectFragments(notes.changelog, notes.version, date, notes.fragments));
	if (notes.fragments.length === 0) {
		return 0;
	}
	yield* fs.writeFileString(join(directory, "CHANGELOG.md"), changelog);
	yield* Effect.forEach(notes.fragments, ({ name }) => fs.remove(join(directory, "changes", name)));
	return notes.fragments.length;
});
