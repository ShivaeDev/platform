import { Deferred, Effect, Fiber } from "effect";
import { type Body, effectOf } from "./body.ts";
import { databaseActions } from "./databaseVerbs.ts";
import { database, type Engine } from "./engine.ts";

const BATCH_FAILED = "the batch failed";

export function batchVerb(engine: Engine, tell: (line: string) => void) {
	const channel = engine.channel();
	const { on } = databaseActions(engine, tell);
	function mainDatabase() {
		return database(engine, "main");
	}
	function untilDone(signal: Deferred.Deferred<void>, fiber: Fiber.Fiber<unknown, unknown>) {
		return Effect.raceFirst(Deferred.await(signal), Effect.asVoid(Fiber.await(fiber)));
	}

	function batch<A, E, R>(body: Body<A, E, R>) {
		return Effect.gen(function* () {
			const ending = engine.batchEnding;
			tell(`main opens a batch that ${ending}`);
			const work = effectOf(body);
			if (ending === "succeeds") {
				return yield* Effect.asVoid(on(mainDatabase())(channel.batch(work)));
			}
			if (ending === "fails") {
				return yield* on(mainDatabase())(channel.batch(Effect.andThen(work, Effect.fail(BATCH_FAILED)))).pipe(
					Effect.catchIf(
						(error) => error === BATCH_FAILED,
						() => Effect.void,
					),
				);
			}
			const ran = yield* Deferred.make<void>();
			const fiber = yield* Effect.forkChild(
				on(mainDatabase())(channel.batch(Effect.andThen(work, Effect.andThen(Deferred.succeed(ran, undefined), Effect.never)))),
			);
			yield* untilDone(ran, fiber);
			yield* Fiber.interrupt(fiber);
		});
	}

	return batch;
}
