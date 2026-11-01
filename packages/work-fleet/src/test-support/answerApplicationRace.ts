import { Deferred, Effect, Fiber, Layer } from "effect";
import { BoardGateway } from "#policy.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

interface ApplicationRace {
	application?: Fiber.Fiber<unknown, unknown>;
	readonly entered: Deferred.Deferred<void>;
	readonly release: Deferred.Deferred<void>;
}

const races = new WeakMap<HostStoryEngine, ApplicationRace>();

export function configureAnswerApplicationRace(engine: HostStoryEngine) {
	engine.board = (fixture) => {
		if (fixture.parts.board === undefined) {
			throw new Error("Expected the fixture Board layer");
		}
		return Layer.effect(BoardGateway)(pausedReads(engine)).pipe(Layer.provideMerge(fixture.parts.board));
	};
}

const pausedReads = Effect.fnUntraced(function* (engine: HostStoryEngine) {
	const board = yield* BoardGateway;
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	races.set(engine, { entered, release });
	yield* Effect.addFinalizer(() => Deferred.succeed(release, undefined));
	let paused = false;
	const readDecision: typeof board.readDecision = Effect.fnUntraced(function* (input) {
		const reading = yield* board.readDecision(input);
		const span = yield* Effect.currentSpan.pipe(Effect.orDie);
		if (reading._tag === "Response" && span.name === "Fleet.readResolution" && !paused) {
			paused = true;
			yield* Deferred.succeed(entered, undefined);
			yield* Deferred.await(release);
		}
		return reading;
	});
	return { ...board, readDecision };
});

export function answerApplicationRaceVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	function race() {
		const value = races.get(engine);
		if (value === undefined) {
			throw new Error("Configure an in-flight answer first");
		}
		return value;
	}
	return {
		beginAnswerApplication: (workId: string) =>
			Effect.gen(function* () {
				tell(`Fleet begins applying the recorded answer for ${workId}`);
				const value = race();
				value.application = yield* engine.fleet.reconcile(workId).pipe(Effect.forkScoped);
				yield* Deferred.await(value.entered);
			}),
		finishAnswerApplication: () =>
			Effect.gen(function* () {
				tell("the in-flight answer finishes applying");
				const value = race();
				if (value.application === undefined) {
					return yield* Effect.die("Begin applying an answer first");
				}
				yield* Deferred.succeed(value.release, undefined);
				yield* Fiber.join(value.application);
			}),
	};
}
