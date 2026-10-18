import { dirname } from "node:path";
import process from "node:process";
import { Effect, FileSystem, Schema } from "effect";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { State, WatchError } from "./model.ts";

function failure(cause: unknown) {
	return new WatchError({ message: cause instanceof Error ? cause.message : "State file operation failed" });
}
export const StateFile = defineService({
	id: "@shivaedev/pr-watch/StateFile",
	initialize: FileSystem.FileSystem,
	methods: (fs) => ({
		load: (path: string, repository: string) =>
			Effect.gen(function* () {
				const text = yield* fs.readFileString(path).pipe(
					Effect.catchTag("PlatformError", (error) => (error.reason._tag === "NotFound" ? Effect.succeed(undefined) : Effect.fail(error))),
					Effect.mapError(failure),
				);
				if (text === undefined) {
					return { prs: {}, repository, version: 1 } satisfies State;
				}
				const state = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(State))(text).pipe(Effect.mapError(failure));
				if (state.repository !== repository) {
					return yield* Effect.fail(new WatchError({ message: "State file belongs to a different repository" }));
				}
				return state;
			}),
		save: (path: string, state: State) =>
			Effect.gen(function* () {
				yield* fs.makeDirectory(dirname(path), { recursive: true });
				const temporary = `${path}.${process.pid}.tmp`;
				yield* fs.writeFileString(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
				yield* fs.rename(temporary, path);
			}).pipe(Effect.mapError(failure)),
	}),
	requires: [FileSystem.FileSystem],
});
