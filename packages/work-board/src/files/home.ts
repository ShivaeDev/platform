import { Data, Effect, FileSystem, Option, Path } from "effect";
import { listMarkdown } from "./list.ts";

export class HomeMissing extends Data.TaggedError("HomeMissing")<{ readonly message: string }> {}

export const homeIn = Effect.fn("WorkBoard.homeIn")(function* (root: string, home: string | undefined) {
	if (home === undefined) {
		return undefined;
	}
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const missing = new HomeMissing({ message: `The home file ${home} is not a markdown file in ${root}` });
	const realRoot = yield* fs.realPath(root);
	const real = yield* Effect.option(fs.realPath(path.resolve(root, home)));
	if (Option.isNone(real)) {
		return yield* missing;
	}
	const target = yield* Effect.option(fs.stat(real.value));
	if (Option.isNone(target)) {
		return yield* missing;
	}
	const files = yield* listMarkdown(root, realRoot);
	const logical = path.relative(root, path.resolve(root, home)).split(path.sep).join("/");
	if (files.some((file) => file.path === logical)) {
		return logical;
	}
	const relative = path.relative(realRoot, real.value).split(path.sep).join("/");
	if (files.some((file) => file.path === relative)) {
		return relative;
	}
	const inode = Option.getOrUndefined(target.value.ino);
	const same = (info: FileSystem.File.Info) => inode !== undefined && info.dev === target.value.dev && Option.getOrUndefined(info.ino) === inode;
	const matches = yield* Effect.filter(files, (file) =>
		Effect.map(Effect.option(fs.stat(path.join(realRoot, file.path))), (info) => Option.isSome(info) && same(info.value)),
	);
	const direct = yield* Effect.filter(matches, (file) =>
		Effect.map(Effect.option(fs.realPath(path.join(realRoot, file.path))), (real) => Option.contains(real, path.join(realRoot, file.path))),
	);
	const chosen = matches.find((file) => file.path.toLowerCase() === relative.toLowerCase()) ?? direct[0] ?? matches[0];
	return chosen === undefined ? yield* missing : chosen.path;
});
