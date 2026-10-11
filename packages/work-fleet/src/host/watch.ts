import { Console, Deferred, Effect, Stream } from "effect";
import { waitingOwner } from "#attention.ts";
import { follow } from "#host/follow.ts";
import type { WaitOptions } from "#host/wait.ts";
import { settled, WAIT_EXIT } from "#host/waitOutcome.ts";

export interface WatchOptions extends Omit<WaitOptions, "workId"> {
	readonly workIds: readonly string[];
}

export const watchFor = Effect.fn("FleetWatch.watchFor")(function* (options: WatchOptions) {
	const ready = yield* Deferred.make<void>();
	let pending = options.workIds.length === 0 ? undefined : new Set(options.workIds);
	const order = ["maintainer", "orchestrator", "automation", undefined];
	const consume = follow(options, options.workIds).pipe(
		Stream.tap(() => Deferred.succeed(ready, undefined)),
		Stream.tap((states) =>
			Effect.gen(function* () {
				pending ??= new Set(states.map((state) => state.workId));
				for (const state of [...states].sort((left, right) => order.indexOf(waitingOwner(left)) - order.indexOf(waitingOwner(right)))) {
					const outcome = settled(state.workId, state);
					if (outcome !== undefined && pending.delete(state.workId)) {
						yield* Console.log(outcome.summary.replace(/[\r\n]+/gu, " "));
					}
				}
			}),
		),
		Stream.takeUntil(() => pending?.size === 0),
		Stream.runDrain,
	);
	yield* options.timeoutMs === undefined
		? consume
		: Effect.raceFirst(consume, Deferred.await(ready).pipe(Effect.andThen(Effect.sleep(options.timeoutMs))));
	if (pending?.size === 0) {
		return WAIT_EXIT.completed;
	}
	yield* Console.error("watch: timed out waiting for Fleet work");
	return WAIT_EXIT.timeout;
});
