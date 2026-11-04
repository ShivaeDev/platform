import { Effect } from "effect";
import type { GitHub } from "#GitHub.ts";
import type { Emit } from "#health.ts";
import type { Options, State } from "#model.ts";
import { requestFailure } from "#requestFailure.ts";
import type { WatcherState } from "#Watcher/initialize.ts";

type ObservationFailure = Effect.Error<ReturnType<typeof GitHub.Service.snapshot>>;

function prioritizeFailure(previous: ObservationFailure | undefined, next: ObservationFailure) {
	return previous === undefined || requestFailure(previous).retryable ? next : previous;
}

export function poll(operations: WatcherState) {
	const { commit, observe, targets } = operations;
	return <E, R, TDiagnosticError, TDiagnosticRequirements>(
		options: Options,
		previous: State,
		emit: Emit<E, R>,
		diagnostic: (failure: ObservationFailure) => Effect.Effect<void, TDiagnosticError, TDiagnosticRequirements>,
	) =>
		Effect.gen(function* () {
			let state: State = { ...previous, prs: { ...previous.prs } };
			const targetsForRound = yield* targets(options, state);
			const { numbers, queue } = targetsForRound;
			state = targetsForRound.state;
			let failure: ObservationFailure | undefined;
			for (const number of numbers) {
				const result = yield* Effect.result(observe(options, number, queue, state.prs[String(number)]));
				if (result._tag === "Failure") {
					yield* diagnostic(result.failure);
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
		});
}
