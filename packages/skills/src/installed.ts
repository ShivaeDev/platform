import { Effect, FileSystem, Path, Schema } from "effect";

export interface Installed {
	readonly root: string;
	readonly skills: readonly string[];
	readonly version: string;
}

const PackageManifest = Schema.fromJsonString(Schema.Struct({ version: Schema.String }));

export const readInstalled = Effect.fn("Skills.readInstalled")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const { version } = yield* Schema.decodeUnknownEffect(PackageManifest)(yield* fs.readFileString(path.join(root, "package.json")));
	const names = yield* fs.readDirectory(path.join(root, "skills"));
	const skills = yield* Effect.filter(names, (name) => fs.exists(path.join(root, "skills", name, "SKILL.md")));
	const installed: Installed = { root, skills: skills.sort(), version };
	return installed;
});
