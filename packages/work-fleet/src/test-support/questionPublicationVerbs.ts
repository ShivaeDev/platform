import { rmSync } from "node:fs";
import { join } from "node:path";
import { Clock, Deferred, Effect, Layer } from "effect";
import { BoardGateway } from "#policy.ts";
import { appliedAnswer } from "#test/daemonActions.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

export function questionPublicationBoard(engine: HostStoryEngine) {
	const original = engine.fixture.parts.board;
	if (original === undefined) {
		return original;
	}
	return Layer.effect(BoardGateway)(
		Effect.map(BoardGateway, (board) => ({
			...board,
			decision: (...args: Parameters<typeof board.decision>) => {
				const clock = engine.questionRegistrationClock;
				engine.questionRegistrationClock = undefined;
				const decision = board.decision(...args);
				return clock === undefined ? decision : decision.pipe(Effect.provideService(Clock.Clock, clock));
			},
		})),
	).pipe(Layer.provideMerge(original));
}

export function questionPublicationVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		pauseAnswerRegistration: (workId: string, text: string) =>
			Effect.gen(function* () {
				tell(`answer ${workId} and pause before registering its question`);
				const entered = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const clock = yield* Clock.Clock;
				const registeredAt = (yield* clock.currentTimeMillis) - 60_000;
				const pausedClock: Clock.Clock = {
					currentTimeMillis: Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(registeredAt)),
					currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe(),
					currentTimeNanos: clock.currentTimeNanos,
					currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
					monotonicTimeNanos: clock.monotonicTimeNanos,
					monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
					sleep: (duration) => clock.sleep(duration),
				};
				engine.questionRegistrationClock = pausedClock;
				yield* engine.running.client("daemon.answer", { text, workId });
				return {
					entered: Effect.raceFirst(
						Deferred.await(entered),
						appliedAnswer(engine.running.client, workId).pipe(Effect.andThen(Effect.die("The answer did not reach registration"))),
					).pipe(Effect.timeout("3 seconds")),
					release: Deferred.succeed(release, undefined),
					result: appliedAnswer(engine.running.client, workId),
				};
			}),
		publishDecision: (workId: string) => {
			tell(`publish ${workId}'s question through the Fleet engine`);
			return engine.fleet.publishDecision(workId).pipe(Effect.provideContext(engine.running.context));
		},
		removeBoard: (file: string) => {
			tell(`remove Board source ${file}`);
			rmSync(join(engine.fixture.host.boardDir, file));
		},
	};
}
