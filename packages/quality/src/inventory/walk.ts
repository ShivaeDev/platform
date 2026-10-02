import { join, relative, sep } from "node:path";
import { Effect, FileSystem } from "effect";
import { type FilesystemFailure, orWhenAbsent, readOptionalText } from "./filesystem.ts";
import { emptyScope, type IgnoreScope, insideKept, verdictFor, withIgnoreFile } from "./ignore-scope.ts";

const SKIPPED = new Set([".git", "node_modules"]);

export const ignoreScopeAt = (
	dir: string,
	inherited: IgnoreScope = emptyScope,
): Effect.Effect<IgnoreScope, FilesystemFailure, FileSystem.FileSystem> =>
	Effect.map(readOptionalText(join(dir, ".gitignore")), (contents) =>
		contents === undefined || contents === "" ? inherited : withIgnoreFile(inherited, dir, contents),
	);

// The walk itself never visits the directories between the root and a source, so their ignore files are read here.
export const scopeAbove = (root: string, dir: string): Effect.Effect<IgnoreScope, FilesystemFailure, FileSystem.FileSystem> => {
	const parts = relative(root, dir)
		.split(sep)
		.filter((part) => part !== "");
	const ancestors = parts.length === 0 ? [] : [root, ...parts.slice(0, -1).map((_, index) => join(root, ...parts.slice(0, index + 1)))];
	return Effect.reduce(
		ancestors,
		() => emptyScope,
		(scope, ancestor) => ignoreScopeAt(ancestor, scope),
	);
};

export const walk = (dir: string, inherited: IgnoreScope = emptyScope): Effect.Effect<readonly string[], FilesystemFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const scope = yield* ignoreScopeAt(dir, inherited);
		const entries = yield* orWhenAbsent<readonly string[]>(dir, fs.readDirectory(dir), []);
		const nested = yield* Effect.forEach(
			entries.filter((entry) => !SKIPPED.has(entry)),
			(entry) => walkEntry(join(dir, entry), scope),
			{ concurrency: 1 },
		);
		return nested.flat();
	});

const walkEntry = (path: string, scope: IgnoreScope): Effect.Effect<readonly string[], FilesystemFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const info = yield* orWhenAbsent<FileSystem.File.Info | undefined>(path, fs.stat(path), undefined);
		if (info === undefined) {
			return [];
		}
		const directory = info.type === "Directory";
		const verdict = verdictFor(scope, path, directory);
		if (verdict === "ignored") {
			return [];
		}
		if (!directory) {
			return [path];
		}
		return yield* walk(path, verdict === "kept" ? insideKept(scope, path) : scope);
	});
