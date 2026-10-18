import { Console, Deferred, Effect, Stream } from "effect";
import { waitingOwner } from "#attention.ts";
import { follow } from "#host/follow.ts";
import { type FollowState, followOutcome, unrecognizedState } from "#host/followState.ts";
import type { WaitOptions } from "#host/wait.ts";
import { type State, settled, WAIT_EXIT } from "#host/waitOutcome.ts";

export interface WatchOptions extends Omit<WaitOptions, "workId"> {
	readonly workIds: readonly string[];
}

export const watchFor = Effect.fn("FleetWatch.watchFor")(function* (options: WatchOptions) {
	const ready = yield* Deferred.make<void>();
	let initialSnapshot = true;
	let pending = options.workIds.length === 0 ? undefined : new Set(options.workIds);
	const progressOutcome = transitionOutcome();
	const outcomeFor = options.follow
		? transitionOutcome()
		: (state: typeof State.Type) => {
				const outcome = settled(state.workId, state);
				if (outcome !== undefined) {
					return pending?.delete(state.workId) ? outcome : undefined;
				}
				return state.recovery === undefined ? undefined : progressOutcome(state);
			};
	const order = ["maintainer", "orchestrator", "automation", undefined];
	const consume = follow(options, options.workIds).pipe(
		Stream.tap(() => Deferred.succeed(ready, undefined)),
		Stream.tap((states) =>
			Effect.gen(function* () {
				pending ??= new Set(states.map((state) => state.workId));
				for (const state of [...states].sort((left, right) => order.indexOf(waitingOwner(left)) - order.indexOf(waitingOwner(right)))) {
					const outcome = outcomeFor(state);
					if (
						outcome !== undefined
						&& !(options.follow && initialSnapshot && state.stage !== "needs-human" && !unrecognizedState(state) && state.recovery === undefined)
					) {
						yield* Console.log(outcome.summary.replace(/[\r\n]+/gu, " "));
					}
				}
				initialSnapshot = false;
			}),
		),
		Stream.takeUntil(() => !options.follow && pending?.size === 0),
		Stream.runDrain,
	);
	yield* options.timeoutMs === undefined
		? consume
		: Effect.raceFirst(
				consume,
				options.follow ? Effect.sleep(options.timeoutMs) : Deferred.await(ready).pipe(Effect.andThen(Effect.sleep(options.timeoutMs))),
			);
	if (!options.follow && pending?.size === 0) {
		return WAIT_EXIT.completed;
	}
	yield* Console.error("watch: timed out waiting for Fleet work");
	return WAIT_EXIT.timeout;
});

function transitionOutcome() {
	const previous = new Map<string, string>();
	return (state: FollowState) => {
		const outcome = followOutcome(state);
		if (outcome === undefined) {
			previous.delete(state.workId);
			return undefined;
		}
		const key =
			state.stage === "needs-human"
				? JSON.stringify([state.decision?.id, state.decision?.code, outcome.summary])
				: JSON.stringify([state.stage, outcome.summary]);
		if (previous.get(state.workId) === key) {
			return undefined;
		}
		previous.set(state.workId, key);
		return outcome;
	};
}
