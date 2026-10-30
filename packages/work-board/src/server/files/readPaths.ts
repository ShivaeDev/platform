import { Effect, FileSystem, Path, type PlatformError } from "effect";

export const readPaths = Effect.fn("WorkBoard.readPaths")(function* (realRoot: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	type Resolved = Effect.Effect<string, PlatformError.PlatformError>;
	const paths = new Map<string, Resolved>([["", Effect.succeed(realRoot)]]);
	function resolve(relative: string): Resolved {
		return Effect.gen(function* () {
			const hit = paths.get(relative);
			if (hit) {
				return yield* hit;
			}
			const read = yield* Effect.cached(
				Effect.gen(function* () {
					const separator = relative.lastIndexOf("/");
					const parent = yield* resolve(separator === -1 ? "" : relative.slice(0, separator));
					const file = path.join(parent, relative.slice(separator + 1));
					const info = yield* fs.lstat(file);
					return info.type === "SymbolicLink" ? yield* fs.realPath(file) : file;
				}),
			);
			paths.set(relative, read);
			return yield* read;
		});
	}
	return resolve;
});
