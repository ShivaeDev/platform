import { Effect } from "effect";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { events } from "#events.ts";
import { GitHub } from "#GitHub.ts";
import type { Options, Snapshot, State, WatchError } from "#model.ts";
import { StateFile } from "#StateFile.ts";

function activeNumbers(options: Options, state: State) {
	return [...new Set([...options.numbers, ...(state.openNumbers ?? []), ...Object.keys(state.prs).map(Number)])].filter((number) => {
		const saved = state.prs[String(number)];
		return saved === undefined || (saved.state === "open" && !saved.merged);
	});
}
function prioritizeFailure(previous: WatchError | undefined, next: WatchError) {
	return previous === undefined || previous.retryable === true ? next : previous;
}
export const Watcher = defineService({
	id: "@shivaedev/pr-watch/Watcher",
	initialize: Effect.gen(function* () {
		return { file: yield* StateFile, github: yield* GitHub };
	}),
	methods: ({ file, github }) => {
		function commit(state: State, snapshot: Snapshot, options: Options, emit: (line: string) => Effect.Effect<void, WatchError>) {
			return Effect.uninterruptible(
				Effect.gen(function* () {
					const before = state.prs[String(snapshot.number)];
					const baseline =
						before === undefined && snapshot.state === "closed" && state.openNumbers?.includes(snapshot.number)
							? { ...snapshot, merged: false, state: "open" as const }
							: before;
					for (const line of events(baseline, snapshot, options.events)) {
						yield* emit(line);
					}
					const next = {
						...state,
						openNumbers: (state.openNumbers ?? []).filter((number) => number !== snapshot.number),
						prs: { ...state.prs, [String(snapshot.number)]: snapshot },
					};
					yield* file.save(options.stateFile, next);
					return next;
				}),
			);
		}
		function observe(options: Options, number: number, queue: ReadonlySet<number>, before: Snapshot | undefined) {
			return Effect.gen(function* () {
				const snapshot = yield* github.snapshot(options, number, queue);
				if (snapshot === undefined) {
					return undefined;
				}
				return before?.queued === true && snapshot.state === "open" && !snapshot.queued ? yield* github.confirmQueue(options, snapshot) : snapshot;
			});
		}
		function targets(options: Options, state: State) {
			return Effect.gen(function* () {
				const discovered = options.fleet ? yield* github.discover(options) : [];
				const openNumbers = [...new Set([...(state.openNumbers ?? []), ...discovered])].filter((number) => state.prs[String(number)] === undefined);
				const next = openNumbers.length === (state.openNumbers?.length ?? 0) ? state : { ...state, openNumbers };
				if (next !== state) {
					yield* Effect.uninterruptible(file.save(options.stateFile, next));
				}
				const numbers = activeNumbers(options, next);
				const queue = numbers.length > 0 ? yield* github.queue(options) : new Set<number>();
				return { numbers, queue, state: next };
			});
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
					const targetsForRound = yield* targets(options, state);
					const { numbers, queue } = targetsForRound;
					state = targetsForRound.state;
					let failure: WatchError | undefined;
					for (const number of numbers) {
						const result = yield* Effect.result(observe(options, number, queue, state.prs[String(number)]));
						if (result._tag === "Failure") {
							yield* diagnostic(result.failure.message);
							failure = prioritizeFailure(failure, result.failure);
							continue;
						}
						if (result.success !== undefined) {
							state = yield* commit(state, result.success, options, emit);
						}
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
