import { Effect } from "effect";
import type { GitHub } from "#github/service.ts";
import type { Emit } from "#health.ts";
import type { Options, State } from "#model.ts";
import { requestFailure } from "#requestFailure.ts";
import { commit } from "#watcher/commit.ts";
import { Watcher } from "#watcher/service.ts";

type ObservationFailure = Effect.Error<ReturnType<typeof GitHub.Service.snapshot>>;

function prioritizeFailure(previous: ObservationFailure | undefined, next: ObservationFailure) {
	return previous === undefined || requestFailure(previous).retryable ? next : previous;
}

export const poll = Effect.fn("Watcher.poll")(
	<E, R, TDiagnosticError, TDiagnosticRequirements>(
		options: Options,
		previous: State,
		emit: Emit<E, R>,
		diagnostic: (failure: ObservationFailure) => Effect.Effect<void, TDiagnosticError, TDiagnosticRequirements>,
	) =>
		Effect.gen(function* () {
			const round = yield* Watcher;
			let state: State = { ...previous, prs: { ...previous.prs } };
			const targetsForRound = yield* round.targets(options, state);
			const { numbers, queue } = targetsForRound;
			state = targetsForRound.state;
			let failure: ObservationFailure | undefined;
			for (const number of numbers) {
				const result = yield* Effect.result(round.observe(options, number, queue, state.prs[String(number)]));
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
		}),
);
