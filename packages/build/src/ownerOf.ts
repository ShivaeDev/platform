import { Effect, Option, Path, Schema } from "effect";
import { readIfPresent } from "#files.ts";

// The package a module belongs to: the nearest package.json above it that has a name.
export interface Owner {
	readonly directory: string;
	readonly name: string;
}

const Manifest = Schema.fromJsonString(Schema.Struct({ name: Schema.optionalKey(Schema.String) }));

const decodeManifest = Schema.decodeUnknownOption(Manifest);

export const ownerOf = Effect.fn("Build.ownerOf")(function* (id: string, owners: Map<string, Option.Option<Owner>>) {
	const path = yield* Path.Path;
	if (!path.isAbsolute(id)) {
		return Option.none<Owner>();
	}
	const visited: string[] = [];
	for (let directory = path.dirname(id); ; directory = path.dirname(directory)) {
		const known = owners.get(directory);
		if (known !== undefined) {
			for (const each of visited) {
				owners.set(each, known);
			}
			return known;
		}
		visited.push(directory);
		const name = Option.flatMap(yield* readIfPresent(path.join(directory, "package.json")), (text) =>
			Option.flatMap(decodeManifest(text), (manifest) => Option.fromUndefinedOr(manifest.name)),
		);
		if (Option.isSome(name) || path.dirname(directory) === directory) {
			const found = Option.map(name, (each): Owner => ({ directory, name: each }));
			for (const each of visited) {
				owners.set(each, found);
			}
			return found;
		}
	}
});
