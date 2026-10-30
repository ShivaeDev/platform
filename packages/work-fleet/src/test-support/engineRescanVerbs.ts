import { join } from "node:path";
import { Effect, Fiber } from "effect";
import { withBoardReadPass } from "#board/readPass.ts";
import { type EngineStory, running } from "#test/engineState.ts";

export function engineRescanVerbs(state: EngineStory, tell: (line: string) => void) {
	function start(entered: Effect.Effect<void>, release?: Effect.Effect<boolean>) {
		return Effect.gen(function* () {
			const scan = yield* withBoardReadPass(running(state).fleet.briefProblem("item.0", join(state.root, "0.md")), { fresh: true }).pipe(
				Effect.forkScoped,
			);
			if (release !== undefined) {
				yield* Effect.addFinalizer(() => release);
			}
			state.rescan = { finished: Fiber.join(scan).pipe(Effect.asVoid), release };
			yield* entered;
		});
	}
	return {
		boardRescanInFlight: () => state.bufferedBoard?.readingBriefs() ?? false,
		finishBoardRescan: () =>
			Effect.gen(function* () {
				tell("let the Board reads finish");
				if (state.rescan === undefined) {
					return yield* Effect.die("No rescan is in flight");
				}
				if (state.rescan.release !== undefined) {
					yield* state.rescan.release;
				}
				yield* state.rescan.finished;
			}),
		startBoardRescan: () =>
			Effect.gen(function* () {
				tell("rescan the Board while its brief reads are in flight");
				if (state.sourceReads === undefined) {
					return yield* Effect.die("No tracked Board is configured");
				}
				const gate = yield* state.sourceReads.pauseReads;
				yield* start(gate.entered, gate.release);
			}),
		startBufferedBoardRescan: () =>
			Effect.gen(function* () {
				tell("rescan the Board while all brief reads can complete immediately");
				if (state.bufferedBoard === undefined) {
					return yield* Effect.die("No buffered Board is configured");
				}
				yield* start(yield* state.bufferedBoard.observeReads);
			}),
	};
}
