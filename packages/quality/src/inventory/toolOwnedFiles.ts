import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Path, Result, Schema } from "effect";
import { ignorePatterns } from "#adapters/ignore.ts";
import { GlobDeclarations, globPatterns, validateGlobs } from "#config/globs.ts";
import { FilesystemFailure, readRequiredText } from "#inventory/filesystem.ts";
import { posix } from "#inventory/ignoreScope.ts";
import { walk } from "#inventory/walk.ts";
import { PackageManifest } from "#PackageManifest.ts";

const decodeManifest = Schema.decodeUnknownResult(Schema.fromJsonString(PackageManifest));

export const toolOwnedFiles = Effect.fn("Inventory.toolOwnedFiles")(function* (root: string) {
	const { basename, dirname, join, relative } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));
	const paths = yield* walk(root);
	const manifests = paths.filter((path) => basename(path) === "package.json");
	const owned = yield* Effect.forEach(manifests, (path) =>
		Effect.gen(function* () {
			// Manifest validation reports unreadable or malformed manifests; they establish no ownership.
			const text = yield* readRequiredText(path).pipe(Effect.catchTag("FilesystemFailure", () => Effect.succeed(undefined)));
			if (text === undefined) {
				return [];
			}
			const decoded = decodeManifest(text);
			if (Result.isFailure(decoded)) {
				return [];
			}
			const declarations = yield* Schema.decodeUnknownEffect(GlobDeclarations)(decoded.success.quality?.toolOwned ?? []).pipe(
				Effect.mapError((cause) => new FilesystemFailure({ message: `Cannot read tool-owned facts in ${path}: ${cause.message}`, path })),
			);
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
