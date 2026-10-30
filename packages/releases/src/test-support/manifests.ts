import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { PackageManifest } from "#model.ts";
import { write } from "./fixture.ts";

const Json = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));
const Manifest = Schema.fromJsonString(PackageManifest);
const RANGE_FIELDS = ["dependencies", "optionalDependencies", "peerDependencies"] as const;

export interface FoundManifest {
	readonly directory: string;
	readonly json: Readonly<Record<string, unknown>>;
	readonly manifest: PackageManifest;
	readonly text: string;
}

export const manifests = Effect.fn("ReleasesStory.manifests")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const found: FoundManifest[] = [];
	for (const parent of ["modules", "packages"]) {
		const names = (yield* fs.exists(join(root, parent))) ? yield* fs.readDirectory(join(root, parent)) : [];
		for (const name of names.sort()) {
			const file = join(root, parent, name, "package.json");
			if (yield* fs.exists(file)) {
				const text = yield* fs.readFileString(file);
				found.push({
					directory: `${parent}/${name}`,
					json: Schema.decodeUnknownSync(Json)(text),
					manifest: Schema.decodeUnknownSync(Manifest)(text),
					text,
				});
			}
		}
	}
	return found;
});

export const manifestOf = Effect.fn("ReleasesStory.manifestOf")(function* (root: string, name: string) {
	const found = (yield* manifests(root)).find(({ manifest }) => manifest.name === name);
	return found ?? (yield* Effect.die(new Error(`No workspace package is named ${name}`)));
});

export const editManifest = Effect.fn("ReleasesStory.editManifest")(function* (
	root: string,
	name: string,
	change: (found: FoundManifest) => Readonly<Record<string, unknown>>,
) {
	const found = yield* manifestOf(root, name);
	yield* write(root, `${found.directory}/package.json`, JSON.stringify(change(found)));
});

export function rangeOn({ manifest }: FoundManifest, dependency: string) {
	for (const field of RANGE_FIELDS) {
		const range = manifest[field]?.[dependency];
		if (range !== undefined) {
			return { field, range, ranges: manifest[field] };
		}
	}
	throw new Error(`${manifest.name} declares no published dependency on ${dependency}`);
}
