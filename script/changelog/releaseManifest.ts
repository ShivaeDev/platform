import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { attempt } from "./attempt.ts";

const Manifest = Schema.Struct({
	date: Schema.String,
	fragments: Schema.Array(Schema.Struct({ name: Schema.String, text: Schema.String })),
	version: Schema.String,
});

export type ReleaseManifest = typeof Manifest.Type;
export const decodeReleaseManifest = Schema.decodeUnknownSync(Schema.fromJsonString(Manifest));

export const readReleaseManifest = Effect.fn("Changelog.readReleaseManifest")(function* (directory: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = join(directory, "release.json");
	if (!(yield* fs.exists(path))) {
		return undefined;
	}
	const text = yield* fs.readFileString(path);
	return yield* attempt(() => decodeReleaseManifest(text));
});
