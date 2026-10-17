import { dirname } from "node:path";
import { Data, Effect, FileSystem } from "effect";
import type { PlatformError } from "effect/PlatformError";

const ABSENT = new Set(["ENOENT", "ENOTDIR"]);

export class FilesystemFailure extends Data.TaggedError("FilesystemFailure")<{
	readonly message: string;
	readonly path: string;
}> {}

// Effect maps ENOTDIR and EISDIR to BadResource; the original errno remains on the cause.
function errnoOf(error: PlatformError): string {
	const cause: unknown = error.reason.cause;
	return typeof cause === "object" && cause !== null && "code" in cause && typeof cause.code === "string" ? cause.code : "";
}

function failure(path: string, error: PlatformError): FilesystemFailure {
	return new FilesystemFailure({ message: `cannot read ${path}: ${error.message}`, path });
}

export function orWhenAbsent<TValue>(
	path: string,
	action: Effect.Effect<TValue, PlatformError, FileSystem.FileSystem>,
	whenAbsent: TValue,
): Effect.Effect<TValue, FilesystemFailure, FileSystem.FileSystem> {
	return Effect.catchTag(action, "PlatformError", (error) =>
		ABSENT.has(errnoOf(error)) ? Effect.succeed(whenAbsent) : Effect.fail(failure(path, error)),
	);
}

export const readOptionalText = Effect.fn("Inventory.readOptionalText")(function* (
	path: string,
): Effect.fn.Return<string | undefined, FilesystemFailure, FileSystem.FileSystem> {
	const fs = yield* FileSystem.FileSystem;
	return yield* orWhenAbsent<string | undefined>(path, fs.readFileString(path), undefined);
});

export const readRequiredText = Effect.fn("Inventory.readRequiredText")(function* (
	path: string,
): Effect.fn.Return<string, FilesystemFailure, FileSystem.FileSystem> {
	const fs = yield* FileSystem.FileSystem;
	return yield* Effect.mapError(fs.readFileString(path), (error) =>
		ABSENT.has(errnoOf(error)) ? new FilesystemFailure({ message: `required input is missing: ${path}`, path }) : failure(path, error),
	);
});

export const writeText = Effect.fn("Inventory.writeText")(function* (
	path: string,
	text: string,
): Effect.fn.Return<void, FilesystemFailure, FileSystem.FileSystem> {
	const fs = yield* FileSystem.FileSystem;
	const written = Effect.andThen(fs.makeDirectory(dirname(path), { recursive: true }), fs.writeFileString(path, text));
	return yield* Effect.mapError(written, (error) => new FilesystemFailure({ message: `cannot write ${path}: ${error.message}`, path }));
});
