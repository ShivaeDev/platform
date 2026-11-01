import { Deferred, Effect, Fiber } from "effect";
import { defectOf, type Engine, endingOf } from "./engine.ts";

type Save = (subject: string, written?: Deferred.Deferred<void>) => Effect.Effect<void, string>;

export function orderControl(engine: Engine, tell: (line: string) => void, save: Save) {
	function inFlight() {
		const fiber = engine.inFlight;
		if (fiber === undefined) {
			throw new Error("Start saving an order before controlling it");
		}
		return fiber;
	}
	return {
		finishCommit: () =>
			Effect.suspend(() => {
				const gate = engine.commitGate;
				if (gate === undefined) {
					return Effect.die(new Error("Declare commitWaits() before finishing a held commit"));
				}
				tell("the database finishes the held commit");
				return Effect.asVoid(Deferred.succeed(gate.release, undefined));
			}),
		interruptOrder: () =>
			Effect.gen(function* () {
				tell("the caller cancels the order");
				yield* Effect.forkChild(Fiber.interrupt(inFlight()), { startImmediately: true });
			}),
		orderDefect: () => Effect.sync(() => defectOf(engine.order)),
		orderEnding: () =>
			Effect.gen(function* () {
				if (engine.inFlight !== undefined) {
					engine.order = yield* Fiber.await(engine.inFlight);
				}
				return endingOf(engine.order);
			}),
		orderIsSaving: () => Effect.sync(() => inFlight().pollUnsafe() === undefined),
		saveOrder: (subject: string) =>
			Effect.gen(function* () {
				tell(`main saves ${subject}'s order in a transaction`);
				engine.order = yield* Effect.exit(save(subject));
			}),
		startSavingOrder: (subject: string) =>
			Effect.gen(function* () {
				const gate = engine.commitGate;
				if (gate === undefined) {
					return yield* Effect.die(new Error("Declare commitWaits() before starting an order whose commit waits"));
				}
				tell(`main starts saving ${subject}'s order`);
				const written = yield* Deferred.make<void>();
				const fiber = yield* Effect.forkChild(save(subject, written));
				engine.inFlight = fiber;
				const signal = engine.transactionEnding === "interrupted" ? written : gate.begun;
				yield* Effect.raceFirst(Deferred.await(signal), Effect.asVoid(Fiber.await(fiber)));
			}),
	};
}
