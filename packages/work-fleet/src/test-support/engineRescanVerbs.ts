import { join } from "node:path";
import { Effect, Fiber } from "effect";
import { withBoardReadPass } from "#board/readPass.ts";
import { type EngineStory, running } from "#test/engineState.ts";

export function engineRescanVerbs(state: EngineStory, tell: (line: string) => void) {
	return {
		finishBoardRescan: () =>
			Effect.gen(function* () {
				tell("let the Board reads finish");
				if (state.rescan === undefined) {
					return yield* Effect.die("No rescan is in flight");
				}
				yield* state.rescan.release;
				yield* state.rescan.finished;
			}),
		startBoardRescan: () =>
			Effect.gen(function* () {
				tell("rescan the Board while its brief reads are in flight");
				const source = state.sourceReads;
				if (source === undefined) {
					return yield* Effect.die("No tracked Board is configured");
				}
				const gate = yield* source.pauseReads;
				const scan = yield* withBoardReadPass(running(state).fleet.briefProblem("item.0", join(state.root, "0.md")), { fresh: true }).pipe(
					Effect.forkScoped,
				);
				yield* Effect.addFinalizer(() => gate.release);
				state.rescan = { ...gate, finished: Fiber.join(scan).pipe(Effect.asVoid) };
				yield* gate.entered;
			}),
	};
}
