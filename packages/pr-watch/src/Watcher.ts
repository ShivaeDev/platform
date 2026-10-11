import { Effect } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { events } from "./events.ts";
import { GitHub } from "./GitHub.ts";
import type { Options, Snapshot, State, WatchError } from "./model.ts";
import { StateFile } from "./StateFile.ts";
export const Watcher = defineService({
	id: "@shivaedev/pr-watch/Watcher",
	initialize: Effect.gen(function* () {
		return { file: yield* StateFile, github: yield* GitHub };
	}),
	methods: ({ file, github }) => {
		function commit(state: State, snapshot: Snapshot, options: Options, emit: (line: string) => Effect.Effect<void, WatchError>) {
			return Effect.uninterruptible(
				Effect.gen(function* () {
					for (const line of events(state.prs[String(snapshot.number)], snapshot)) {
						yield* emit(line);
					}
					const next = { ...state, prs: { ...state.prs, [String(snapshot.number)]: snapshot } };
					yield* file.save(options.stateFile, next);
					return next;
				}),
			);
		}
		return {
			delay: github.delay,
			load: (options: Options) => file.load(options.stateFile, options.repository),
			poll: (
				options: Options,
				previous: State,
				emit: (line: string) => Effect.Effect<void, WatchError>,
				diagnostic: (message: string) => Effect.Effect<void, WatchError>,
			) =>
				Effect.gen(function* () {
					let state: State = { ...previous, prs: { ...previous.prs } };
					const discovered = options.fleet ? yield* github.discover(options) : [];
					const numbers = new Set([...options.numbers, ...discovered, ...Object.keys(state.prs).map(Number)]);
					const queue = yield* github.queue(options);
					let failure: WatchError | undefined;
					for (const number of numbers) {
						const result = yield* Effect.result(github.snapshot(options, number, queue));
						if (result._tag === "Failure") {
							yield* diagnostic(result.failure.message);
							failure = result.failure;
							continue;
						}
						state = yield* commit(state, result.success, options, emit);
					}
					if (failure !== undefined) {
						return yield* Effect.fail(failure);
					}
					return state;
				}),
		};
	},
	requires: [GitHub, StateFile],
});
