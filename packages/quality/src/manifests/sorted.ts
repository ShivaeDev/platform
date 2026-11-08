import { basename, join, relative } from "node:path";
import { Effect, FileSystem } from "effect";
import { ManifestFailure, manifestEntry } from "#adapters/manifestInventory.ts";
import { manifestReader } from "#adapters/manifestReader.ts";
import { sortingOf } from "#adapters/manifestSorting.ts";
import type { SetupFailure } from "#failure.ts";
import { FilesystemFailure } from "#inventory/filesystem.ts";
import { posix } from "#inventory/ignoreScope.ts";
import { skillCopies } from "#inventory/skillCopies.ts";
import { walk } from "#inventory/walk.ts";
import type { RuleServices } from "#rule.ts";

export const manifestsIn = Effect.fn("Manifests.manifestsIn")(function* (root: string) {
	const copies = yield* skillCopies(root);
	return (yield* walk(root))
		.filter((path) => basename(path) === "package.json")
		.filter((path) => !copies.owns(path))
		.map((path) => posix(relative(root, path)))
		.sort();
});

export const sortManifests = Effect.fn("Manifests.sortManifests")(function* (
	root: string,
): Effect.fn.Return<number, FilesystemFailure | ManifestFailure | SetupFailure, RuleServices> {
	const fs = yield* FileSystem.FileSystem;
	const manifests = yield* manifestsIn(root);
	const readText = yield* manifestReader(root);
	const written = yield* Effect.forEach(manifests, (path) =>
		Effect.gen(function* () {
			const absolute = join(root, path);
			const entry = yield* manifestEntry(readText, path);
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
