import { Effect, FileSystem, Option, Path, type PlatformError } from "effect";

export interface MarkdownFile {
	readonly path: string;
	readonly modified: number;
}

const skipped = (segment: string): boolean => segment.startsWith(".") || segment === "node_modules";

export const isMarkdown = (path: string): boolean => path.endsWith(".md") && !path.split("/").some(skipped);

export const within = (realRoot: string, separator: string, real: string): boolean => real === realRoot || real.startsWith(`${realRoot}${separator}`);

const folderOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf("/")));

const byFolder = (left: string, right: string): number => folderOf(left).localeCompare(folderOf(right)) || left.localeCompare(right);

type Listing = Effect.Effect<ReadonlyArray<MarkdownFile>, PlatformError.PlatformError>;

export const listMarkdown = Effect.fn("WorkBoard.listMarkdown")(function* (root: string, realRoot: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const visited = new Set<string>();
	const entry = (relative: string): Listing =>
		Effect.gen(function* () {
			const real = yield* Effect.option(fs.realPath(path.join(root, relative)));
			if (Option.isNone(real) || !within(realRoot, path.sep, real.value)) {
				return [];
			}
			const info = yield* Effect.option(fs.stat(real.value));
			if (Option.isNone(info)) {
				return [];
			}
			if (info.value.type === "Directory") {
				return yield* Effect.orElseSucceed(folder(relative, real.value), () => []);
			}
			const modified = Option.match(info.value.mtime, { onNone: () => 0, onSome: (date) => date.getTime() });
			return info.value.type === "File" && relative.endsWith(".md") ? [{ path: relative, modified }] : [];
		});
	const folder = (relative: string, real: string): Listing =>
		Effect.gen(function* () {
			if (visited.has(real)) {
				return [];
			}
			visited.add(real);
			const names = yield* fs.readDirectory(real);
			const found = yield* Effect.forEach(
				names.filter((name) => !skipped(name)),
				(name) => entry(relative === "" ? name : `${relative}/${name}`),
			);
			return found.flat();
		});
	const files = yield* folder("", realRoot);
	return files.toSorted((left, right) => byFolder(left.path, right.path));
});
