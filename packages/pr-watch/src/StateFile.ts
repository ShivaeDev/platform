import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";
import { Effect, Schema } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { State, WatchError } from "./model.ts";

function failure(cause: unknown) {
	return new WatchError({ message: cause instanceof Error ? cause.message : "State file operation failed" });
}
function readExisting(path: string) {
	return readFile(path, "utf8").catch((cause: unknown) => {
		if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
			return undefined;
		}
		throw cause;
	});
}
export const StateFile = defineService({
	id: "@shivaedev/pr-watch/StateFile",
	initialize: Effect.void,
	methods: () => ({
		load: (path: string, repository: string) =>
			Effect.gen(function* () {
				const text = yield* Effect.tryPromise({ catch: failure, try: () => readExisting(path) });
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
			Effect.tryPromise({
				catch: failure,
				try: async () => {
					await mkdir(dirname(path), { recursive: true });
					const temporary = `${path}.${process.pid}.tmp`;
					await writeFile(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
					await rename(temporary, path);
				},
			}),
	}),
	requires: [],
});
