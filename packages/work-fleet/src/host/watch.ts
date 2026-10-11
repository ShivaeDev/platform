import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { readWaitStates } from "#host/readWaitStates.ts";
import type { WaitOptions } from "#host/wait.ts";
import { settled, WAIT_EXIT } from "#host/waitOutcome.ts";

export interface WatchOptions extends Omit<WaitOptions, "workId"> {
	readonly workIds: readonly string[];
}

const report = Effect.fn("FleetWatch.report")(function* (states: Effect.Success<ReturnType<typeof readWaitStates>>, pending?: Set<string>) {
	const remaining = pending ?? new Set(states.map((state) => state.workId));
	for (const state of states) {
		const outcome = settled(state.workId, state);
		if (outcome !== undefined && remaining.delete(state.workId)) {
			yield* Console.log(outcome.summary.replace(/[\r\n]+/gu, " "));
		}
	}
	return remaining;
});

export const watchFor = Effect.fn("FleetWatch.watchFor")(function* (options: WatchOptions) {
	const deadline = (yield* Clock.currentTimeMillis) + (options.timeoutMs ?? Number.POSITIVE_INFINITY);
	let pending = options.workIds.length === 0 ? undefined : new Set(options.workIds);
	let unreachable = 0;
	while (true) {
		const next = yield* readWaitStates(options, pending === undefined ? undefined : [...pending]).pipe(Effect.result);
		unreachable = next._tag === "Success" ? 0 : unreachable + 1;
		if (next._tag === "Success") {
			pending = yield* report(next.success, pending);
		} else if (unreachable >= 20) {
			yield* Console.error(`watch: Fleet PostgreSQL is unreachable (${next.failure.message})`);
			return WAIT_EXIT.error;
		}
		if (pending?.size === 0) {
			return WAIT_EXIT.completed;
		}
		if ((yield* Clock.currentTimeMillis) >= deadline) {
			yield* Console.error("watch: timed out waiting for Fleet work");
			return WAIT_EXIT.timeout;
		}
		yield* Effect.sleep(options.intervalMs);
	}
});
