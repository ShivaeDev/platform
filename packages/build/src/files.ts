import { Effect, FileSystem, Option, Path } from "effect";

export const readIfPresent = Effect.fn("Build.readIfPresent")(function* (file: string) {
	const fs = yield* FileSystem.FileSystem;
	return yield* fs.readFileString(file).pipe(
		Effect.map(Option.some),
		Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(Option.none<string>())),
	);
});

// A reader never sees half a file: the text goes to a fresh file beside the target, which then replaces it in one rename. The
// draft lives in a temporary folder of its own, removed when the write ends however it ends.
export const writeAtomically = Effect.fn("Build.writeAtomically")(function* (file: string, text: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	yield* fs.makeDirectory(path.dirname(file), { recursive: true });
	yield* Effect.scoped(
		Effect.gen(function* () {
			const draft = yield* fs.makeTempFileScoped({ directory: path.dirname(file), prefix: `.${path.basename(file)}.` });
			yield* fs.writeFileString(draft, text);
			yield* fs.rename(draft, file);
		}),
	);
});
