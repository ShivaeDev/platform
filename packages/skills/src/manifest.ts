import { Effect, FileSystem, Option, Path, Schema } from "effect";
import { MANIFEST } from "./layout.ts";
import { SkillsError } from "./SkillsError.ts";

export const Manifest = Schema.Struct({
	skills: Schema.Record(Schema.String, Schema.String),
	version: Schema.String,
});
export type Manifest = typeof Manifest.Type;

const ManifestFile = Schema.fromJsonString(Manifest);

export const readManifest = Effect.fn("Skills.readManifest")(function* (repo: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const file = path.join(repo, MANIFEST);
	if (!(yield* fs.exists(file))) {
		return Option.none<Manifest>();
	}
	const text = yield* fs.readFileString(file);
	return Option.some(
		yield* Schema.decodeUnknownEffect(ManifestFile)(text).pipe(
			Effect.mapError(
				() => new SkillsError({ message: `${MANIFEST} is not a manifest this package wrote. Delete it and the folders it listed, then sync.` }),
			),
		),
	);
});

export const writeManifest = Effect.fn("Skills.writeManifest")(function* (repo: string, manifest: Manifest) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const skills = Object.fromEntries(Object.entries(manifest.skills).sort(([a], [b]) => a.localeCompare(b)));
	yield* fs.makeDirectory(path.dirname(path.join(repo, MANIFEST)), { recursive: true });
	yield* fs.writeFileString(path.join(repo, MANIFEST), `${JSON.stringify({ skills, version: manifest.version }, null, "\t")}\n`);
});
