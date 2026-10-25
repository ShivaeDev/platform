import { dirname, join, relative, sep } from "node:path";
import { Effect, FileSystem } from "effect";
import { FilesystemFailure, orWhenAbsent, readOptionalText } from "./filesystem.ts";
import { emptyScope, type IgnoreScope, insideKept, verdictFor, withIgnoreFile } from "./ignoreScope.ts";
import { ignoredPaths, trackedPaths } from "./trackedPaths.ts";

const SKIPPED = new Set([".git", ".worktrees", "node_modules"]);

export function ignoreScopeAt(
	dir: string,
	inherited: IgnoreScope = emptyScope,
): Effect.Effect<IgnoreScope, FilesystemFailure, FileSystem.FileSystem> {
	if (inherited.ignored !== undefined) {
		return Effect.succeed(inherited);
	}
	return Effect.map(readOptionalText(join(dir, ".gitignore")), (contents) =>
		contents === undefined || contents === "" ? inherited : withIgnoreFile(inherited, dir, contents),
	);
}

export const scopeAbove = Effect.fnUntraced(function* (
	root: string,
	dir: string,
): Effect.fn.Return<IgnoreScope, FilesystemFailure, FileSystem.FileSystem> {
	const ignored = yield* Effect.tryPromise({
		catch: (cause) => new FilesystemFailure({ message: `cannot list ignored files in ${dir}: ${String(cause)}`, path: dir }),
		try: () => ignoredPaths(dir),
	});
	if (ignored !== undefined) {
		return { ...emptyScope, ignored: new Set(ignored) };
	}
	const parts = relative(root, dir)
		.split(sep)
		.filter((part) => part !== "");
	const ancestors = parts.length === 0 ? [] : [root, ...parts.slice(0, -1).map((_, index) => join(root, ...parts.slice(0, index + 1)))];
	return yield* Effect.reduce(
		ancestors,
		() => emptyScope,
		(scope, ancestor) => (verdictFor(scope, ancestor, true) === "ignored" ? Effect.succeed(scope) : ignoreScopeAt(ancestor, scope)),
	);
});

export const walk = Effect.fnUntraced(function* (
	dir: string,
	inherited?: IgnoreScope,
): Effect.fn.Return<readonly string[], FilesystemFailure, FileSystem.FileSystem> {
	const fs = yield* FileSystem.FileSystem;
	if ((yield* orWhenAbsent<FileSystem.File.Info | undefined>(dir, fs.stat(dir), undefined)) === undefined) {
		return [];
	}
	const paths = yield* Effect.tryPromise({
		catch: (cause) => new FilesystemFailure({ message: `cannot list tracked files in ${dir}: ${String(cause)}`, path: dir }),
		try: () => trackedPaths(dir),
	});
	const tracked = new Set(paths);
	for (const path of paths) {
		for (let folder = dirname(path); folder !== dir && folder !== dirname(folder); folder = dirname(folder)) {
			tracked.add(folder);
		}
	}
	return yield* walkDirectory(dir, inherited ?? (yield* scopeAbove(dir, dir)), tracked);
});

const walkDirectory = Effect.fnUntraced(function* (
	dir: string,
	inherited: IgnoreScope,
	tracked: ReadonlySet<string>,
): Effect.fn.Return<readonly string[], FilesystemFailure, FileSystem.FileSystem> {
	const fs = yield* FileSystem.FileSystem;
	const scope = verdictFor(inherited, dir, true) === "ignored" ? inherited : yield* ignoreScopeAt(dir, inherited);
	const entries = yield* orWhenAbsent<readonly string[]>(dir, fs.readDirectory(dir), []);
	const nested = yield* Effect.forEach(
		entries.filter((entry) => !SKIPPED.has(entry)),
		(entry) => walkEntry(join(dir, entry), scope, tracked),
		{ concurrency: 1 },
	);
	return nested.flat();
});

const walkEntry = Effect.fnUntraced(function* (
	path: string,
	scope: IgnoreScope,
	tracked: ReadonlySet<string>,
): Effect.fn.Return<readonly string[], FilesystemFailure, FileSystem.FileSystem> {
	const fs = yield* FileSystem.FileSystem;
	const info = yield* orWhenAbsent<FileSystem.File.Info | undefined>(path, fs.stat(path), undefined);
	if (info === undefined) {
		return [];
	}
	const directory = info.type === "Directory";
	const verdict = verdictFor(scope, path, directory);
	if (verdict === "ignored" && !tracked.has(path)) {
		return [];
	}
	if (!directory) {
		return [path];
	}
	return yield* walkDirectory(path, verdict === "kept" ? insideKept(scope, path) : scope, tracked);
});
