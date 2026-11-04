import { Effect, FileSystem, Schema } from "effect";
import { State, WatchError } from "#model.ts";
import { failure } from "#StateFile/failure.ts";

export const load = Effect.fn("StateFile.load")((path: string, repository: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const text = yield* fs.readFileString(path).pipe(
			Effect.catchTag("PlatformError", (error) => (error.reason._tag === "NotFound" ? Effect.succeed(undefined) : Effect.fail(error))),
			Effect.mapError(failure),
		);
		if (text === undefined) {
			return { prs: {}, repository, version: 1 } satisfies State;
		}
		const state = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(State))(text).pipe(Effect.mapError(failure));
		if (state.repository !== repository) {
			return yield* Effect.fail(new WatchError({ message: "State file belongs to a different repository", reason: "state" }));
		}
		return state;
	}),
);
