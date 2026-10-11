import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { attempt } from "./attempt.ts";
import type { Fragment } from "./fragments.ts";

export interface PackageNotes {
	readonly changelog: string;
	readonly fragments: readonly Fragment[];
	readonly version: string;
}
const Manifest = Schema.Struct({ version: Schema.String });

export function decodeVersion(text: string): string {
	return Schema.decodeUnknownSync(Schema.fromJsonString(Manifest))(text).version;
}

export const readPackage = Effect.fn("Changelog.readPackage")(function* (directory: string) {
	const fs = yield* FileSystem.FileSystem;
	const manifest = yield* fs.readFileString(join(directory, "package.json"));
	const version = yield* attempt(() => decodeVersion(manifest));
	const changelog = yield* fs.readFileString(join(directory, "CHANGELOG.md"));
	const changes = join(directory, "changes");
	const names = (yield* fs.exists(changes)) ? yield* fs.readDirectory(changes) : [];
	const fragments = yield* Effect.forEach(
		names.filter((name) => name.endsWith(".md")),
		(name) => Effect.map(fs.readFileString(join(changes, name)), (text) => ({ name, text })),
	);
	return { changelog, fragments, version };
});
