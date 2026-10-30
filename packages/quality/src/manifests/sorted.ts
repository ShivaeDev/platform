import { basename, join, relative } from "node:path";
import { Effect, FileSystem } from "effect";
import { sortPackageJson } from "sort-package-json";
import { ManifestFailure, manifestEntry } from "#adapters/manifestInventory.ts";
import { manifestReader } from "#adapters/manifestReader.ts";
import { FilesystemFailure } from "#inventory/filesystem.ts";
import { posix } from "#inventory/ignoreScope.ts";
import { walk } from "#inventory/walk.ts";

export type Sorting = { readonly _tag: "Sorted" } | { readonly _tag: "Unsorted"; readonly sorted: string };

export function manifestsIn(root: string): Effect.Effect<readonly string[], FilesystemFailure, FileSystem.FileSystem> {
	return Effect.map(walk(root), (paths) =>
		paths
			.filter((path) => basename(path) === "package.json")
			.map((path) => posix(relative(root, path)))
			.sort(),
	);
}

export function sortingOf(text: string): Sorting {
	const sorted = sortPackageJson(text);
	return sorted === text ? { _tag: "Sorted" } : { _tag: "Unsorted", sorted };
}

export const sortManifests = Effect.fn("Manifests.sortManifests")(function* (
	root: string,
): Effect.fn.Return<number, FilesystemFailure | ManifestFailure, FileSystem.FileSystem> {
	const fs = yield* FileSystem.FileSystem;
	const manifests = yield* manifestsIn(root);
	const readText = yield* manifestReader(root);
	const written = yield* Effect.forEach(manifests, (path) =>
		Effect.gen(function* () {
			const absolute = join(root, path);
			const entry = yield* Effect.tryPromise({
				catch: (cause) =>
					cause instanceof ManifestFailure ? cause : new FilesystemFailure({ message: cause instanceof Error ? cause.message : String(cause), path }),
				try: () => manifestEntry(readText, path),
			});
			if (entry === undefined) {
				return false;
			}
			const sorting = sortingOf(entry.text);
			if (sorting._tag !== "Unsorted") {
				return false;
			}
			yield* fs.writeFileString(absolute, sorting.sorted);
			return true;
		}).pipe(
			Effect.mapError((error) =>
				error instanceof ManifestFailure
					? new ManifestFailure({ message: `cannot sort ${path}: ${error.message}`, path })
					: new FilesystemFailure({ message: `cannot sort ${path}: ${error.message}`, path }),
			),
		),
	);
	return written.filter(Boolean).length;
});
