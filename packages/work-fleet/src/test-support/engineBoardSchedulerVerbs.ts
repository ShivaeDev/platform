import { Deferred, Effect } from "effect";
import { run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import type { SessionReceipt } from "#session/schema.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { openFleetBoard } from "#test/withFleetBoard.ts";

export function engineBoardSchedulerVerbs(state: EngineStory, tell: (line: string) => void) {
	function provider() {
		if (state.schedulerProvider === undefined) {
			throw new Error("No scheduler provider is configured");
		}
		return state.schedulerProvider;
	}
	return {
		finishSchedulerTurn: (receipt: SessionReceipt | undefined) => {
			if (receipt === undefined) {
				throw new Error("No worker receipt is recorded");
			}
			tell(`the provider completes ${receipt.turnId}`);
			provider().finish(receipt);
		},
		holdSchedulerObservation: (receipt: SessionReceipt | undefined) => {
			if (receipt === undefined) {
				throw new Error("No worker receipt is recorded");
			}
			tell(`hold the provider observation of ${receipt.turnId}`);
			return provider().hold(receipt.sessionId);
		},
		startBoardReadScheduler: (workId: string) =>
			Effect.gen(function* () {
				tell("start the autonomous scheduler with a Board admission read");
				if (state.root === "") {
					return yield* Effect.die("No Markdown Board is configured");
				}
				const board = yield* openFleetBoard(state.root);
				const sleeping = yield* Deferred.make<void>();
				const pause = Deferred.succeed(sleeping, undefined).pipe(Effect.andThen(Effect.never));
				const runner = yield* Effect.scoped(run(pause, board.get(workId).pipe(Effect.asVoid, Effect.orDie))).pipe(
					Effect.provideService(Fleet, running(state).fleet),
					Effect.forkChild,
				);
				return { runner, sleeping: Deferred.await(sleeping) };
			}),
	};
}
