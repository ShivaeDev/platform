import { basename, join, relative } from "node:path";
import { Effect, FileSystem } from "effect";
import { sortPackageJson } from "sort-package-json";
import { FilesystemFailure } from "#inventory/filesystem.ts";
import { posix } from "#inventory/ignore-scope.ts";
import { walk } from "#inventory/walk.ts";

export type Sorting = { readonly _tag: "Invalid" } | { readonly _tag: "Sorted" } | { readonly _tag: "Unsorted"; readonly sorted: string };

export function manifestsIn(root: string): Effect.Effect<readonly string[], FilesystemFailure, FileSystem.FileSystem> {
	return Effect.map(walk(root), (paths) =>
		paths
			.filter((path) => basename(path) === "package.json")
			.map((path) => posix(relative(root, path)))
			.sort(),
	);
}

export function sortingOf(text: string): Sorting {
	try {
		JSON.parse(text);
	} catch {
		return { _tag: "Invalid" };
	}
	const sorted = sortPackageJson(text);
	return sorted === text ? { _tag: "Sorted" } : { _tag: "Unsorted", sorted };
}

export function sortManifests(root: string): Effect.Effect<number, FilesystemFailure, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const manifests = yield* manifestsIn(root);
		const written = yield* Effect.forEach(manifests, (path) =>
			Effect.gen(function* () {
				const absolute = join(root, path);
				const sorting = sortingOf(yield* fs.readFileString(absolute));
				if (sorting._tag !== "Unsorted") {
					return false;
				}
				yield* fs.writeFileString(absolute, sorting.sorted);
				return true;
			}).pipe(Effect.mapError((error) => new FilesystemFailure({ message: `cannot sort ${path}: ${error.message}`, path }))),
		);
		return written.filter(Boolean).length;
	});
}
