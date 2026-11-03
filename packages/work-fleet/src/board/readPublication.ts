import { Effect, FileSystem } from "effect";
import { ReportFileFailure } from "#reportFileFailure.ts";

export const readPublication = Effect.fn("Fleet.readPublication")(function* (
	root: string,
	realRoot: string,
	path: string,
	limit: { readonly bytes: number; readonly reason: string },
) {
	const fs = yield* FileSystem.FileSystem;
	const target = `${realRoot}/${path}`;
	const read = Effect.gen(function* () {
		const workspace = yield* fs.lstat(root);
		if (workspace.type !== "Directory" || (yield* fs.realPath(root)) !== realRoot) {
			return yield* Effect.fail(new ReportFileFailure({ path, reason: "The workspace root changed" }));
		}
		const info = yield* fs.lstat(target);
		if (info.type !== "File" || (yield* fs.realPath(target)) !== target) {
			return yield* Effect.fail(new ReportFileFailure({ path, reason: "Publication target must be a regular file within the Board" }));
		}
		if (info.size > limit.bytes) {
			return yield* Effect.fail(new ReportFileFailure({ path, reason: limit.reason }));
		}
		return yield* fs.readFileString(target);
	});
	return yield* read.pipe(
		Effect.catchTag("PlatformError", (cause) =>
			cause.reason._tag === "NotFound" ? Effect.succeed(undefined) : Effect.fail(new ReportFileFailure({ cause, path, reason: cause.message })),
		),
	);
});
