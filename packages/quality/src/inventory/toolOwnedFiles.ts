import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Path, Schema } from "effect";
import { ignorePatterns } from "#adapters/ignore.ts";
import { GlobDeclarations, globPatterns, validateGlobs } from "#config/globs.ts";
import { FilesystemFailure, readRequiredText } from "#inventory/filesystem.ts";
import { posix } from "#inventory/ignoreScope.ts";
import { walk } from "#inventory/walk.ts";

const Manifest = Schema.fromJsonString(Schema.Struct({ quality: Schema.optionalKey(Schema.Struct({ toolOwned: GlobDeclarations })) }));

export const toolOwnedFiles = Effect.fn("Inventory.toolOwnedFiles")(function* (root: string) {
	const { basename, dirname, join, relative } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));
	const paths = yield* walk(root);
	const manifests = paths.filter((path) => basename(path) === "package.json");
	const owned = yield* Effect.forEach(manifests, (path) =>
		Effect.gen(function* () {
			const text = yield* readRequiredText(path);
			const manifest = yield* Schema.decodeUnknownEffect(Manifest)(text).pipe(
				Effect.mapError((cause) => new FilesystemFailure({ message: `Cannot read tool-owned facts in ${path}: ${cause.message}`, path })),
			);
			const declarations = manifest.quality?.toolOwned ?? [];
			const directory = dirname(path);
			const files = paths.map((file) => posix(relative(directory, file))).filter((file) => !file.startsWith("../"));
			const problems = validateGlobs({ files, options: { toolOwned: declarations } });
			if (problems.length > 0) {
				return yield* new FilesystemFailure({ message: `${path}: ${problems.join("; ")}`, path });
			}
			const matcher = ignorePatterns([...globPatterns(declarations)]);
			return files.filter((file) => matcher.ignores(file)).map((file) => posix(relative(root, join(directory, file))));
		}),
	);
	return [...new Set(owned.flat())];
});
