import { Deferred, Effect, Fiber } from "effect";
import { databaseActions, REJECTED } from "./databaseVerbs.ts";
import { database, type Engine, endingOf } from "./engine.ts";
import { change } from "./fakeDatabase.ts";
import { orderControl } from "./orderControl.ts";

export type StragglerWork = "record bob's change" | "open a transaction for bob's order";

export function orderVerbs(engine: Engine, tell: (line: string) => void) {
	const { database: actions, transaction } = databaseActions(engine, tell);
	const main = actions("main");
	function mainDatabase() {
		return database(engine, "main");
	}
	function rollback() {
		return Effect.suspend(() => {
			tell("the body rolls its transaction back");
			return Effect.fail(REJECTED);
		});
	}
	function orderEnd(subject: string, written: Deferred.Deferred<void> | undefined) {
		switch (engine.transactionEnding) {
			case "rejected":
				return rollback();
			case "died":
				return Effect.die(new Error(`${subject}'s order is malformed`));
			case "interrupted":
				return written === undefined ? Effect.void : Effect.andThen(Deferred.succeed(written, undefined), Effect.never);
			case "commit failed":
			case undefined:
				return Effect.void;
		}
	}

	function order(subject: string, written?: Deferred.Deferred<void>) {
		return transaction(mainDatabase(), Effect.andThen(main.write(`${subject}'s order`, change(subject)), orderEnd(subject, written)));
	}

	function leaveStraggler(work: StragglerWork) {
		return Effect.gen(function* () {
			const release = yield* Deferred.make<void>();
			const late = work === "record bob's change" ? main.record(change("bob")) : main.inTransaction(main.write("bob's order", change("bob")));
			const fiber = yield* Effect.forkChild(Effect.andThen(Deferred.await(release), late));
			engine.straggler = { fiber, release };
		});
	}

	return {
		...orderControl(engine, tell, order),
		rollback,
		saveOrderLeavingStraggler: (subject: string, work: StragglerWork) =>
			Effect.gen(function* () {
				tell(`main saves ${subject}'s order, and a fiber forked inside its transaction waits to ${work}`);
				yield* main.inTransaction(Effect.andThen(main.write(`${subject}'s order`, change(subject)), leaveStraggler(work)));
			}),
		saveOrderWithoutTransaction: (subject: string) =>
			Effect.gen(function* () {
				tell(`main saves ${subject}'s order outside any transaction`);
				engine.order = yield* Effect.exit(main.write(`${subject}'s order`, change(subject)));
			}),
		stragglerEnding: () => Effect.sync(() => endingOf(engine.stragglerExit)),
		stragglerResumes: () =>
			Effect.gen(function* () {
				const straggler = engine.straggler;
				if (straggler === undefined) {
					return yield* Effect.die(new Error("Save an order that leaves a straggler before resuming it"));
				}
				tell("the straggler resumes after the transaction committed");
				yield* Deferred.succeed(straggler.release, undefined);
				engine.stragglerExit = yield* Fiber.await(straggler.fiber);
			}),
	};
}
