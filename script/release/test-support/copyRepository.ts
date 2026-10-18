import { execFileSync } from "node:child_process";
import { lstat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Effect, FileSystem } from "effect";

export const copyRepository = Effect.fn("ReleaseStory.copyRepository")(function* (repository: string, root: string) {
	const fs = yield* FileSystem.FileSystem;
	const files = yield* Effect.try(() =>
		execFileSync("git", ["-C", repository, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" })
			.split("\0")
			.filter(Boolean),
	);
	for (const relative of files) {
		const source = join(repository, relative);
		if (yield* fs.exists(source)) {
			yield* fs.makeDirectory(dirname(join(root, relative)), { recursive: true });
			const info = yield* Effect.tryPromise({ catch: (cause) => new Error(`Cannot inspect ${source}`, { cause }), try: () => lstat(source) });
			if (info.isSymbolicLink()) {
				yield* fs.symlink(yield* fs.readLink(source), join(root, relative));
			} else {
				yield* fs.copy(source, join(root, relative));
			}
		}
	}
});
