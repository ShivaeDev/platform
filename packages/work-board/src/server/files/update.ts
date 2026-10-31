import { Effect, FileSystem, Option } from "effect";
import { attachmentType } from "#path/attachment.ts";
import { isMarkdown } from "#path/isMarkdown.ts";
import { byFolder, listMarkdown, type MarkdownFile } from "./list.ts";
import { markdownPath } from "./markdownPath.ts";

export const updateFiles = Effect.fn("WorkBoard.updateFiles")(function* (
	root: string,
	realRoot: string,
	previous: readonly MarkdownFile[],
	paths: ReadonlySet<string> | undefined,
) {
	const fs = yield* FileSystem.FileSystem;
	// Root disappearance must reach callers as a filesystem failure.
	yield* fs.stat(realRoot);
	if (
		paths === undefined
		|| [...paths].some(
			(path) => (!isMarkdown(path) && attachmentType(path) === undefined) || previous.some((file) => file.path.startsWith(`${path}/`)),
		)
	) {
		return yield* listMarkdown(root, realRoot);
	}
	const files = new Map(previous.map((file) => [file.path, file]));
	for (const file of paths) {
		if (!isMarkdown(file)) {
			continue;
		}
		const found = yield* Effect.option(
			Effect.gen(function* () {
				const real = yield* markdownPath(root, realRoot, file);
				if (!real) {
					return undefined;
				}
				const info = yield* fs.stat(real);
				if (info.type === "Directory") {
					return "directory";
				}
				return info.type === "File"
					? { modified: Option.match(info.mtime, { onNone: () => 0, onSome: (date) => date.getTime() }), path: file }
					: undefined;
			}),
		);
		files.delete(file);
		if (Option.isSome(found) && found.value === "directory") {
			return yield* listMarkdown(root, realRoot);
		}
		if (Option.isSome(found) && found.value && typeof found.value !== "string") {
			files.set(file, found.value);
		}
	}
	return [...files.values()].toSorted((left, right) => byFolder(left.path, right.path));
});
