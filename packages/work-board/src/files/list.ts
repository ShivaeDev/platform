import { Effect, FileSystem, Option, Path, type PlatformError } from "effect";
import { isMarkdown as markdown } from "#path/isMarkdown.ts";

export interface MarkdownFile {
	readonly modified: number;
	readonly path: string;
}

export function isMarkdown(path: string): boolean {
	return markdown(path);
}

export const within = (realRoot: string, separator: string, real: string): boolean => real === realRoot || real.startsWith(`${realRoot}${separator}`);

const folderOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf("/")));

const byFolder = (left: string, right: string): number => folderOf(left).localeCompare(folderOf(right)) || left.localeCompare(right);

type Listing = Effect.Effect<readonly MarkdownFile[], PlatformError.PlatformError>;

export const scanMarkdown = Effect.fn("WorkBoard.scanMarkdown")(function* (root: string, realRoot: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const roots: Array<{ readonly real: string; readonly relative: string }> = [{ real: realRoot, relative: "" }];
	const entry = (relative: string, boundary: string, ancestors: ReadonlySet<string>, parent: string): Listing =>
		Effect.gen(function* () {
			const real = yield* Effect.option(fs.realPath(path.join(root, relative)));
			if (Option.isNone(real)) {
				return [];
			}
			const info = yield* Effect.option(fs.stat(real.value));
			if (Option.isNone(info)) {
				return [];
			}
			if (info.value.type === "Directory") {
				return yield* directory(relative, real.value, boundary, ancestors, real.value !== path.join(parent, path.basename(relative)));
			}
			const modified = Option.match(info.value.mtime, { onNone: () => 0, onSome: (date) => date.getTime() });
			return info.value.type === "File" && relative.endsWith(".md") && within(boundary, path.sep, real.value) ? [{ modified, path: relative }] : [];
		});
	function directory(relative: string, real: string, boundary: string, ancestors: ReadonlySet<string>, alias: boolean): Listing {
		if (ancestors.has(real) || within(real, path.sep, realRoot)) {
			return Effect.succeed([]);
		}
		const linked = !within(boundary, path.sep, real);
		if (alias) {
			roots.push({ real, relative });
		}
		return Effect.orElseSucceed(folder(relative, real, linked ? real : boundary, ancestors), () => []);
	}
	const folder = (relative: string, real: string, boundary: string, ancestors: ReadonlySet<string>): Listing =>
		Effect.gen(function* () {
			const branch = new Set([...ancestors, real]);
			const names = yield* fs.readDirectory(real);
			const found = yield* Effect.forEach(
				names.filter((name) => !name.startsWith(".") && name !== "node_modules"),
				(name) => entry(relative === "" ? name : `${relative}/${name}`, boundary, branch, real),
			);
			return found.flat();
		});
	const files = yield* folder("", realRoot, realRoot, new Set());
	return { files: files.toSorted((left, right) => byFolder(left.path, right.path)), roots };
});

export const listMarkdown = Effect.fn("WorkBoard.listMarkdown")(function* (root: string, realRoot: string) {
	return (yield* scanMarkdown(root, realRoot)).files;
});
