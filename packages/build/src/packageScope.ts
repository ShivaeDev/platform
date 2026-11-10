import { Effect, FileSystem, Option, Path, Schema } from "effect";

const Manifest = Schema.Struct({
	exports: Schema.optionalKey(Schema.Unknown),
	imports: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
	name: Schema.optionalKey(Schema.String),
});

export interface PackageScope {
	readonly directory: string;
	readonly manifest: typeof Manifest.Type;
}

const decodeManifest = Schema.decodeUnknownEffect(Schema.fromJsonString(Manifest));

// The nearest named package.json above a file decides how the file is imported; a nameless one only sets a folder's module type.
export const packageScopeOf = Effect.fn("Build.packageScopeOf")(function* (file: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	let directory = path.dirname(file);
	for (;;) {
		const manifestPath = path.join(directory, "package.json");
		if (yield* fs.exists(manifestPath)) {
			const manifest = yield* decodeManifest(yield* fs.readFileString(manifestPath));
			if (manifest.name !== undefined) {
				return Option.some<PackageScope>({ directory, manifest });
			}
		}
		const parent = path.dirname(directory);
		if (parent === directory) {
			return Option.none<PackageScope>();
		}
		directory = parent;
	}
});
