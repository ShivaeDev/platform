import { Deferred, Effect, Stream } from "effect";
import { waitingOwner } from "#attention.ts";
import { type FollowOptions, follow } from "#host/follow.ts";
import * as Outcome from "#host/waitOutcome.ts";

export const WAIT_EXIT = Outcome.WAIT_EXIT;
export const WaitState = Outcome.WaitState;
export type WaitState = typeof WaitState.Type;
export const settled = Outcome.settled;
export type WaitOutcome = Outcome.WaitOutcome;

export interface WaitOptions extends FollowOptions {
	readonly workId: string;
}

export const waitFor = Effect.fn("FleetWait.waitFor")(function* (options: WaitOptions) {
	const ready = yield* Deferred.make<void>();
	let last = "not yet known to Fleet";
	let outcome: WaitOutcome | undefined;
	const consume = follow(options, [options.workId]).pipe(
		Stream.tap(() => Deferred.succeed(ready, undefined)),
		Stream.map((states) => states[0]),
		Stream.tap((state) =>
			Effect.sync(() => {
				if (state !== undefined) {
					last = `${state.stage}${waitingOwner({ ...state, step: state.stage }) === undefined ? "" : ` (waiting on ${waitingOwner({ ...state, step: state.stage })})`}${state.blocker === undefined ? "" : `: ${state.blocker}`}`;
					outcome = settled(options.workId, state);
				}
			}),
		),
		Stream.takeUntil(() => outcome !== undefined),
		Stream.runDrain,
	);
	yield* options.timeoutMs === undefined
		? consume
		: Effect.raceFirst(consume, Deferred.await(ready).pipe(Effect.andThen(Effect.sleep(options.timeoutMs))));
	return outcome ?? ({ code: WAIT_EXIT.timeout, summary: `${options.workId} still ${last}: wait timed out` } satisfies WaitOutcome);
});
