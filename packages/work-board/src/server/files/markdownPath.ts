import { Effect, FileSystem, Option, Path } from "effect";
import { isMarkdown, within } from "./list.ts";

export const markdownPath = Effect.fn("WorkBoard.markdownPath")(function* (root: string, realRoot: string, relative: string) {
	if (!isMarkdown(relative) || relative.split("/").some((segment) => segment === "" || segment === "..")) {
		return undefined;
	}
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const segments = relative.split("/");
	const ancestors = new Set([realRoot]);
	let boundary = realRoot;
	for (let index = 0; index < segments.length; index += 1) {
		const real = yield* Effect.option(fs.realPath(path.join(root, ...segments.slice(0, index + 1))));
		if (Option.isNone(real)) {
			return undefined;
		}
		if (index === segments.length - 1) {
			return within(boundary, path.sep, real.value) ? real.value : undefined;
		}
		const info = yield* Effect.option(fs.stat(real.value));
		if (Option.isNone(info) || info.value.type !== "Directory" || ancestors.has(real.value) || within(real.value, path.sep, realRoot)) {
			return undefined;
		}
		ancestors.add(real.value);
		if (!within(boundary, path.sep, real.value)) {
			boundary = real.value;
		}
	}
	return undefined;
});
