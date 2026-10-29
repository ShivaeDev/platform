import { Deferred, Effect, Fiber } from "effect";
import type { Observation } from "#observe.ts";
import { type Body, effectOf } from "./body.ts";
import { driverVerbs } from "./driverVerbs.ts";
import { database, defectOf, type Engine, endingOf, labels } from "./engine.ts";
import { type Change, Current, change, type FakeDatabase } from "./fakeDatabase.ts";

const REJECTED = "rejected";

const BATCH_FAILED = "the batch failed";

export type Place = "outside any transaction" | "in a transaction" | "in a batch" | "in a driver's transaction";

export type StragglerWork = "record bob's change" | "open a transaction for bob's order";

function rejectedBy(error: unknown): error is typeof REJECTED {
	return error === REJECTED;
}

export function verbs(engine: Engine, tell: (line: string) => void) {
	const channel = engine.channel();
	const drivers = driverVerbs(engine, tell);
	function on(owner: FakeDatabase) {
		return <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.provideService(Current, owner), Effect.provide(engine.logs.layer));
	}
	function transaction<A, E, R>(owner: FakeDatabase, body: Effect.Effect<A, E, R>) {
		return on(owner)(channel.within<A, E, R, E | string, R>(owner.transaction)(body));
	}
	function databaseVerbs(name: string) {
		function owner() {
			return database(engine, name);
		}
		return {
			committedRows: () => Effect.sync(() => [...owner().committed]),
			inTransaction: <A, E, R>(body: Body<A, E, R>) =>
				Effect.suspend(() => {
					tell(`${name} begins a transaction`);
					return Effect.asVoid(transaction(owner(), effectOf(body))).pipe(Effect.catchIf(rejectedBy, () => Effect.void));
				}),
			record: (...changes: Change[]) =>
				Effect.suspend(() => {
					tell(`${name} records ${labels(changes).join(", ") || "no changes"}`);
					return on(owner())(channel.record(changes));
				}),
			write: (row: string, ...changes: Change[]) =>
				Effect.suspend(() => {
					tell(`${name} writes ${row}`);
					return on(owner())(Effect.andThen(owner().write(row), channel.record(changes)));
				}),
		};
	}
	const main = databaseVerbs("main");
	function mainDatabase() {
		return database(engine, "main");
	}

	function rollback() {
		return Effect.suspend(() => {
			tell("the body rolls its transaction back");
			return Effect.fail(REJECTED);
		});
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

	function inPlace<A, E, R>(place: Place, body: Body<A, E, R>) {
		switch (place) {
			case "outside any transaction":
				return Effect.asVoid(effectOf(body));
			case "in a transaction":
				return main.inTransaction(body);
			case "in a batch":
				return batch(body);
			case "in a driver's transaction":
				return Effect.gen(function* () {
					const driven = yield* drivers.driverOpens();
					yield* driven.run(body);
					yield* driven.runHook();
					yield* driven.commit();
				});
		}
	}

	function observe(observation: Observation<Change>) {
		return Effect.sync(() => {
			const line = `${labels(observation.changes).join(", ")} ${observation._tag.toLowerCase()}`;
			engine.observed.push(line);
			engine.timeline.push(`the observer sees ${line}`);
		});
	}

	return {
		...main,
		...drivers,
		batch,
		committedSinkReceived: () => Effect.sync(() => [...engine.committedSink]),
		database: databaseVerbs,
		guardAsked: () => Effect.sync(() => [...engine.guardAsked]),
		hookCalls: () => Effect.sync(() => [...engine.hookCalls]),
		inPlace,
		interruptOrder: () =>
			Effect.gen(function* () {
				const fiber = engine.inFlight;
				const gate = engine.commitGate;
				if (fiber === undefined || gate === undefined) {
					return yield* Effect.die(new Error("Start an order whose commit waits before interrupting it"));
				}
				tell("the caller interrupts the order while its commit waits, then the database finishes the commit");
				const interruption = yield* Effect.forkChild(Fiber.interrupt(fiber), { startImmediately: true });
				yield* Deferred.succeed(gate.release, undefined);
				yield* Fiber.join(interruption);
				engine.order = yield* Fiber.await(fiber);
			}),
		loggedErrors: () => Effect.sync(() => [...engine.logs.errors]),
		observed: () => Effect.sync(() => [...engine.observed]),
		observing: <A, E, R>(body: Body<A, E, R>) => Effect.provideService(effectOf(body), channel.Observer, observe),
		orderDefect: () => Effect.sync(() => defectOf(engine.order)),
		orderEnding: () => Effect.sync(() => endingOf(engine.order)),
		published: () => Effect.sync(() => engine.published.map((changes) => [...changes])),
		publishedInAnyOrder: () => Effect.sync(() => engine.published.map((changes) => [...changes].sort((left, right) => left.localeCompare(right)))),
		rollback,
		saveOrder: (subject: string) =>
			Effect.gen(function* () {
				const ending = engine.transactionEnding;
				tell(`main saves ${subject}'s order in a transaction${ending ? ` that ends as ${ending}` : ""}`);
				if (ending !== "interrupted") {
					engine.order = yield* Effect.exit(order(subject));
					return;
				}
				const written = yield* Deferred.make<void>();
				const fiber = yield* Effect.forkChild(order(subject, written));
				yield* untilDone(written, fiber);
				yield* Fiber.interrupt(fiber);
				engine.order = yield* Fiber.await(fiber);
			}),
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
		scopedSinkReceived: () => Effect.sync(() => [...engine.scopedSink]),
		startSavingOrder: (subject: string) =>
			Effect.gen(function* () {
				const gate = engine.commitGate;
				if (gate === undefined) {
					return yield* Effect.die(new Error("Declare commitWaits() before starting an order whose commit waits"));
				}
				tell(`main saves ${subject}'s order, and the database holds its commit`);
				const fiber = yield* Effect.forkDetach(Effect.asVoid(order(subject)));
				engine.inFlight = fiber;
				yield* untilDone(gate.begun, fiber);
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
		timeline: () => Effect.sync(() => [...engine.timeline]),
		withCommittedSink: <A, E, R>(body: Body<A, E, R>) =>
			Effect.provideService(effectOf(body), channel.CommittedSink, (changes: readonly Change[]) =>
				Effect.sync(() => {
					engine.committedSink.push(labels(changes));
				}),
			),
		withScopedHook: <A, E, R>(body: Body<A, E, R>) =>
			Effect.provideService(effectOf(body), channel.BeforeCommit, (changes: readonly Change[]) =>
				Effect.sync(() => {
					engine.hookCalls.push(`the scoped hook sees ${labels(changes).join(", ")}`);
				}),
			),
		withScopedSink: <A, E, R>(body: Body<A, E, R>) =>
			Effect.provideService(effectOf(body), channel.Sink, (changes: readonly Change[]) =>
				Effect.sync(() => {
					engine.scopedSink.push(labels(changes));
				}),
			),
	};
}
