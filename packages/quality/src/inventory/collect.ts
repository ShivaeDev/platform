import { join, relative } from "node:path";
import { Effect, FileSystem } from "effect";
import ignore from "ignore";
import type { SourceFile } from "#rule.ts";
import { FilesystemFailure, orWhenAbsent, readRequiredText } from "./filesystem.ts";
import { posix } from "./ignoreScope.ts";
import { linesOf } from "./linesOf.ts";
import { shadcnFolders } from "./shadcnFolders.ts";
import { scopeAbove, walk } from "./walk.ts";

export interface InventoryScope {
	readonly exclude: readonly string[];
	readonly extensions: readonly string[];
	readonly sources: readonly string[];
}

export interface Inventory {
	readonly files: readonly string[];
	readonly sources: readonly SourceFile[];
}

const READ_CONCURRENCY = 16;

const zoneFiles = Effect.fn("Inventory.zoneFiles")(function* (
	root: string,
	zone: string,
): Effect.fn.Return<readonly string[], FilesystemFailure, FileSystem.FileSystem> {
	const fs = yield* FileSystem.FileSystem;
	const path = join(root, zone);
	if (posix(relative(root, path)).startsWith("..")) {
		return yield* new FilesystemFailure({ message: `source "${zone}" lies outside the repository at ${root}`, path });
	}
	const info = yield* orWhenAbsent<FileSystem.File.Info | undefined>(path, fs.stat(path), undefined);
	if (info === undefined) {
		return yield* new FilesystemFailure({ message: `source "${zone}" does not exist in ${root}`, path });
	}
	return info.type === "Directory" ? yield* walk(path, yield* scopeAbove(root, path)) : [path];
});

function readSource(root: string, path: string): Effect.Effect<SourceFile, FilesystemFailure, FileSystem.FileSystem> {
	return Effect.map(readRequiredText(join(root, path)), (text) => ({ lines: linesOf(text), path, text }));
}

export const collectInventory = Effect.fn("Inventory.collectInventory")(function* (
	root: string,
	scope: InventoryScope,
): Effect.fn.Return<Inventory, FilesystemFailure, FileSystem.FileSystem> {
	const excluded = ignore().add([...scope.exclude]);
	const toolOwned = yield* shadcnFolders(root);
	const zones = yield* Effect.forEach(scope.sources, (zone) => zoneFiles(root, zone), { concurrency: READ_CONCURRENCY });
	const relativePaths = zones.flat().map((absolute) => posix(relative(root, absolute)));
	const files = [...new Set(relativePaths)]
		.filter((path) => !excluded.ignores(path))
		.filter((path) => !toolOwned.some((folder) => path.startsWith(`${folder}/`)))
		.sort((left, right) => {
			if (left === right) {
				return 0;
			}
			return left < right ? -1 : 1;
		});
	const sourcePaths = files.filter((path) => scope.extensions.some((extension) => path.endsWith(extension)));
	const sources = yield* Effect.forEach(sourcePaths, (path) => readSource(root, path), { concurrency: READ_CONCURRENCY });
	return { files, sources };
});
