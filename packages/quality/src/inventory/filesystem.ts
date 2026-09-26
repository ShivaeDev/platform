import { dirname } from "node:path";
import { Data, Effect, FileSystem } from "effect";
import type { PlatformError } from "effect/PlatformError";

const ABSENT = new Set(["ENOENT", "ENOTDIR"]);

export class FilesystemFailure extends Data.TaggedError("FilesystemFailure")<{
	readonly message: string;
	readonly path: string;
}> {}

// Effect maps ENOTDIR and EISDIR to BadResource; the original errno remains on the cause.
const errnoOf = (error: PlatformError): string => {
	const cause: unknown = error.reason.cause;
	return typeof cause === "object" && cause !== null && "code" in cause && typeof cause.code === "string" ? cause.code : "";
};

const failure = (path: string, error: PlatformError): FilesystemFailure =>
	new FilesystemFailure({ message: `cannot read ${path}: ${error.message}`, path });

export const orWhenAbsent = <Value>(
	path: string,
	action: Effect.Effect<Value, PlatformError, FileSystem.FileSystem>,
	whenAbsent: Value,
): Effect.Effect<Value, FilesystemFailure, FileSystem.FileSystem> =>
	Effect.catchTag(action, "PlatformError", (error) => (ABSENT.has(errnoOf(error)) ? Effect.succeed(whenAbsent) : Effect.fail(failure(path, error))));

export const readOptionalText = (path: string): Effect.Effect<string | undefined, FilesystemFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		return yield* orWhenAbsent<string | undefined>(path, fs.readFileString(path), undefined);
	});

export const readRequiredText = (path: string): Effect.Effect<string, FilesystemFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		return yield* Effect.mapError(fs.readFileString(path), (error) =>
			ABSENT.has(errnoOf(error)) ? new FilesystemFailure({ message: `required input is missing: ${path}`, path }) : failure(path, error),
		);
	});

export const writeText = (path: string, text: string): Effect.Effect<void, FilesystemFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const written = Effect.andThen(fs.makeDirectory(dirname(path), { recursive: true }), fs.writeFileString(path, text));
		return yield* Effect.mapError(written, (error) => new FilesystemFailure({ message: `cannot write ${path}: ${error.message}`, path }));
	});
