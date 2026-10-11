import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Random from "effect/Random";
import { waitingOwner } from "#attention.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import * as Outcome from "#host/waitOutcome.ts";

export const WAIT_EXIT = Outcome.WAIT_EXIT;
export const WaitState = Outcome.WaitState;
export type WaitState = typeof WaitState.Type;
export const settled = Outcome.settled;
export type WaitOutcome = Outcome.WaitOutcome;

export interface WaitOptions {
	readonly databaseUrl: string;
	readonly intervalMs: number;
	readonly namespace: string;
	readonly timeoutMs?: number;
	readonly workId: string;
}

const UNREACHABLE_POLLS = 20;

interface Poll {
	readonly failure?: string;
	readonly last?: string;
	readonly outcome?: WaitOutcome | undefined;
}

function poll(options: WaitOptions): Effect.Effect<Poll> {
	return readWaitStates(options, [options.workId]).pipe(
		Effect.map(([state]) =>
			state === undefined
				? {}
				: {
						last: `${state.stage}${waitingOwner(state) === undefined ? "" : ` (waiting on ${waitingOwner(state)})`}${state.blocker === undefined ? "" : `: ${state.blocker}`}`,
						outcome: settled(options.workId, state),
					},
		),
		Effect.catch((error) => Effect.succeed({ failure: error.message })),
	);
}

export const waitFor = Effect.fn("FleetWait.waitFor")(function* (options: WaitOptions) {
	const started = yield* Clock.currentTimeMillis;
	let unreachable = 0;
	let last = "not yet known to Fleet";
	while (true) {
		const next = yield* poll(options);
		if (next.outcome !== undefined) {
			return next.outcome;
		}
		unreachable = next.failure === undefined ? 0 : unreachable + 1;
		if (unreachable >= UNREACHABLE_POLLS) {
			return { code: WAIT_EXIT.error, summary: `${options.workId} unknown: Fleet PostgreSQL is unreachable (${next.failure})` } satisfies WaitOutcome;
		}
		last = next.last ?? last;
		if (options.timeoutMs !== undefined && (yield* Clock.currentTimeMillis) - started >= options.timeoutMs) {
			return { code: WAIT_EXIT.timeout, summary: `${options.workId} still ${last}: wait timed out` } satisfies WaitOutcome;
		}
		// Jitter keeps a hundred waiters from polling PostgreSQL in lockstep.
		yield* Effect.sleep(Duration.millis(Math.round(options.intervalMs * (yield* Random.nextBetween(0.8, 1.2)))));
	}
});
