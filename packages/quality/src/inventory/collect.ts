import { join, relative } from "node:path";
import { Effect, FileSystem } from "effect";
import ignore from "ignore";
import type { SourceFile } from "../rule.ts";
import { FilesystemFailure, orWhenAbsent, readRequiredText } from "./filesystem.ts";
import { posix } from "./ignore-scope.ts";
import { scopeAbove, walk } from "./walk.ts";

export interface InventoryScope {
	readonly sources: ReadonlyArray<string>;
	readonly exclude: ReadonlyArray<string>;
	readonly extensions: ReadonlyArray<string>;
}

export interface Inventory {
	readonly files: ReadonlyArray<string>;
	readonly sources: ReadonlyArray<SourceFile>;
}

const READ_CONCURRENCY = 16;

export const linesOf = (text: string): ReadonlyArray<string> => {
	const lines = text.split("\n");
	return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
};

const zoneFiles = (root: string, zone: string): Effect.Effect<readonly string[], FilesystemFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
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

const readSource = (root: string, path: string): Effect.Effect<SourceFile, FilesystemFailure, FileSystem.FileSystem> =>
	Effect.map(readRequiredText(join(root, path)), (text) => ({ lines: linesOf(text), path, text }));

export const collectInventory = (root: string, scope: InventoryScope): Effect.Effect<Inventory, FilesystemFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const excluded = ignore().add([...scope.exclude]);
		const zones = yield* Effect.forEach(scope.sources, (zone) => zoneFiles(root, zone), { concurrency: READ_CONCURRENCY });
		const relativePaths = zones.flat().map((absolute) => posix(relative(root, absolute)));
		const files = [...new Set(relativePaths)].filter((path) => !excluded.ignores(path)).sort();
		const sourcePaths = files.filter((path) => scope.extensions.some((extension) => path.endsWith(extension)));
		const sources = yield* Effect.forEach(sourcePaths, (path) => readSource(root, path), { concurrency: READ_CONCURRENCY });
		return { files, sources };
	});
