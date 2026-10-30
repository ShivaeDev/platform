import { Effect, FileSystem, Option, Path, type PlatformError } from "effect";
import { isMarkdown } from "#path/isMarkdown.ts";
import { within } from "./list.ts";
import { readPaths } from "./readPaths.ts";

export const markdownPaths = Effect.fn("WorkBoard.markdownPaths")(function* (realRoot: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const resolve = yield* readPaths(realRoot);
	interface Directory {
		readonly ancestors: ReadonlySet<string>;
		readonly boundary: string;
	}
	type Checked = Effect.Effect<Directory | undefined, PlatformError.PlatformError>;
	const directories = new Map<string, Checked>([["", Effect.succeed({ ancestors: new Set([realRoot]), boundary: realRoot })]]);
	function directory(relative: string): Checked {
		return Effect.gen(function* () {
			const hit = directories.get(relative);
			if (hit) {
				return yield* hit;
			}
			const checked = yield* Effect.cached(
				Effect.gen(function* () {
					const parent = yield* directory(relative.slice(0, Math.max(0, relative.lastIndexOf("/"))));
					if (!parent) {
						return undefined;
					}
					const real = yield* resolve(relative);
					const info = yield* fs.stat(real);
					if (info.type !== "Directory" || parent.ancestors.has(real) || within(real, path.sep, realRoot)) {
						return undefined;
					}
					return {
						ancestors: new Set([...parent.ancestors, real]),
						boundary: within(parent.boundary, path.sep, real) ? parent.boundary : real,
					};
				}),
			);
			directories.set(relative, checked);
			return yield* checked;
		});
	}
	return (relative: string): Effect.Effect<string | undefined> =>
		Effect.gen(function* () {
			if (!isMarkdown(relative) || relative.split("/").some((segment) => segment === "" || segment === "..")) {
				return undefined;
			}
			const parent = yield* Effect.option(directory(relative.slice(0, Math.max(0, relative.lastIndexOf("/")))));
			if (Option.isNone(parent) || !parent.value) {
				return undefined;
			}
			const real = yield* Effect.option(resolve(relative));
			return Option.isSome(real) && within(parent.value.boundary, path.sep, real.value) ? real.value : undefined;
		});
});

export const markdownPath = Effect.fn("WorkBoard.markdownPath")(function* (_root: string, realRoot: string, relative: string) {
	return yield* (yield* markdownPaths(realRoot))(relative);
});
