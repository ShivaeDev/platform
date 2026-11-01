import { Effect, FileSystem, Option, Order, Path, PlatformError } from "effect";
import { readPaths } from "./readPaths.ts";

export interface MarkdownFile {
	readonly modified: number;
	readonly path: string;
}

export interface MarkdownInventory {
	readonly files: readonly MarkdownFile[];
	readonly unavailable: readonly string[];
}

export function within(realRoot: string, separator: string, real: string): boolean {
	return real === realRoot || real.startsWith(`${realRoot}${separator}`);
}

function folderOf(path: string): string {
	return path.slice(0, Math.max(0, path.lastIndexOf("/")));
}

export function byFolder(left: string, right: string): number {
	return folderOf(left).localeCompare(folderOf(right)) || left.localeCompare(right);
}

const SCAN_CONCURRENCY = 16;

type Listing = Effect.Effect<readonly MarkdownFile[], PlatformError.PlatformError>;

export const scanMarkdown = Effect.fn("WorkBoard.scanMarkdown")(function* (_root: string, realRoot: string, from = "") {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const resolve = yield* readPaths(realRoot);
	const unavailable = new Set<string>();
	function unresolved(relative: string, failure: PlatformError.PlatformError) {
		if (failure.reason._tag !== "NotFound") {
			unavailable.add(relative);
		}
	}
	const roots: Array<{ readonly real: string; readonly relative: string }> = [{ real: realRoot, relative: "" }];
	function entry(relative: string, boundary: string, ancestors: ReadonlySet<string>, parent: string): Listing {
		return Effect.gen(function* () {
			const real = yield* Effect.result(resolve(relative));
			if (real._tag === "Failure") {
				unresolved(relative, real.failure);
				return [];
			}
			const info = yield* Effect.result(fs.stat(real.success));
			if (info._tag === "Failure") {
				unresolved(relative, info.failure);
				return [];
			}
			if (info.success.type === "Directory") {
				return yield* directory(relative, real.success, boundary, ancestors, real.success !== path.join(parent, path.basename(relative)));
			}
			const modified = Option.match(info.success.mtime, { onNone: () => 0, onSome: (date) => date.getTime() });
			return info.success.type === "File" && relative.endsWith(".md") && within(boundary, path.sep, real.success)
				? [{ modified, path: relative }]
				: [];
		});
	}
	function directory(relative: string, real: string, boundary: string, ancestors: ReadonlySet<string>, alias: boolean): Listing {
		if (ancestors.has(real) || within(real, path.sep, realRoot)) {
			return Effect.succeed([]);
		}
		const linked = !within(boundary, path.sep, real);
		if (alias) {
			roots.push({ real, relative });
		}
		return Effect.gen(function* () {
			const listing = yield* Effect.result(folder(relative, real, linked ? real : boundary, ancestors));
			if (listing._tag === "Failure") {
				unavailable.add(relative);
				return [];
			}
			return listing.success;
		});
	}
	function folder(relative: string, real: string, boundary: string, ancestors: ReadonlySet<string>): Listing {
		return Effect.gen(function* () {
			const branch = new Set([...ancestors, real]);
			const names = yield* fs.readDirectory(real);
			const found = yield* Effect.forEach(
				names.filter((name) => !name.startsWith(".") && name !== "node_modules"),
				(name) => entry(relative === "" ? name : `${relative}/${name}`, boundary, branch, real),
				{ concurrency: SCAN_CONCURRENCY },
			);
			return found.flat();
		});
	}
	const files =
		from === ""
			? yield* folder("", realRoot, realRoot, new Set())
			: yield* entry(from, realRoot, new Set([realRoot]), path.join(realRoot, path.dirname(from)));
	return {
		files: files.toSorted((left, right) => byFolder(left.path, right.path)),
		roots,
		unavailable: [...unavailable].sort(Order.String),
	};
});

export const listMarkdown = Effect.fn("WorkBoard.listMarkdown")(function* (root: string, realRoot: string) {
	const inventory = yield* scanMarkdown(root, realRoot);
	if (inventory.unavailable.length > 0) {
		return yield* Effect.fail(
			PlatformError.systemError({
				_tag: "Unknown",
				description: `Workspace index incomplete; could not read ${inventory.unavailable.join(", ")}.`,
				method: "readDirectory",
				module: "FileSystem",
			}),
		);
	}
	return inventory.files;
});
