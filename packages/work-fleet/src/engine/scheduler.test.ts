import { describe, expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { cycle, run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const awaitStage = Effect.fn("Fleet.awaitStage")(function* (workId: string, stage: string) {
	const fleet = yield* Fleet;
	while ((yield* fleet.get(workId)).value.stage !== stage) {
		yield* Effect.yieldNow;
	}
});
describe("Fleet autonomous scheduling", () => {
	const test = postgresTests("live", "isolated");
	test("a cycle reconciles existing work without also reconciling its new dispatch", () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("two");
				const dispatched = yield* Deferred.make<void>();
				const reconciled: string[] = [];
				let reads = 0;
				const list = Effect.gen(function* () {
					reads += 1;
					if (reads > 1) {
						yield* Deferred.await(dispatched);
					}
					return yield* fleet.list();
				});
				const concurrent = Fleet.of({
					...fleet,
					dispatch: (id) => fleet.dispatch(id).pipe(Effect.tap(() => Deferred.succeed(dispatched, undefined))),
					list: () => list,
					reconcile: (id) => Effect.sync(() => reconciled.push(id)).pipe(Effect.andThen(fleet.reconcile(id))),
				});
				yield* cycle.pipe(Effect.provideService(Fleet, concurrent));
				expect(reconciled).toEqual(["two"]);
				expect((yield* fleet.get("one")).value.stage).toBe("executing");
				expect(fixture.launched).toHaveLength(2);
			}),
		));
	test("terminal reviewer frees capacity for replacement while validation remains suspended", function* () {
		const entered = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const gate = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)));
		yield* withEngine({ checksGate: gate, concurrency: 1 }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				yield* fleet.dispatch("two").pipe(Effect.result);
				expect(fixture.launched).toHaveLength(1);
				finishWorkers(fixture);
				const progression = yield* fleet.reconcile("one").pipe(Effect.forkChild);
				yield* Deferred.await(entered);
				const scheduler = yield* Effect.scoped(run("5 millis")).pipe(Effect.forkChild);
				yield* awaitStage("two", "executing");
				expect((yield* fleet.get("one")).value.stage).toBe("validating");
				expect(fixture.launched).toHaveLength(3);
				while ((yield* fleet.get("two")).value.attempts[0]?.receipt === undefined) {
					yield* Effect.yieldNow;
				}
				yield* Fiber.interrupt(scheduler);
				yield* Fiber.interrupt(progression);
				expect((yield* fleet.get("two")).value.attempts[0]?.receipt?.turnId).toBeDefined();
			}),
		);
	});
	test("a slow independent review does not block disjoint dispatch", function* () {
		const entered = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const gate = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)));
		yield* withEngine({ reviewGate: gate }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const scheduler = yield* Effect.scoped(run("5 millis")).pipe(Effect.forkChild);
				yield* Deferred.await(entered);
				yield* prepareWork("two");
				yield* awaitStage("two", "executing");
				expect((yield* fleet.get("one")).value.stage).toBe("reviewing");
				yield* Fiber.interrupt(scheduler);
			}),
		);
	});
	test("an unpublished decision cannot consume a fabricated response while publication remains interruptible", function* () {
		const entered = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const gate = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)));
		yield* withEngine({ denyDelivery: true, publishGate: gate }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const pending = yield* fleet.reconcile("one").pipe(Effect.forkChild);
				yield* Deferred.await(entered);
				const decision = (yield* fleet.get("one")).value.decision;
				expect(decision).toBeDefined();
				expect(yield* Effect.flip(fleet.resolve("one", decision?.id ?? "missing", "response.unpublished"))).toMatchObject({ reason: "stale" });
				yield* Deferred.succeed(release, undefined);
				expect((yield* Fiber.join(pending)).value.stage).toBe("needs-human");
				yield* fleet.resolve("one", decision?.id ?? "missing", fixture.respond(decision?.id ?? "missing", "release"));
				expect((yield* fleet.get("one")).value.stage).toBe("released");
			}),
		);
	});
});
