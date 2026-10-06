import { describe, expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const awaitStage = Effect.fn("Fleet.awaitStage")(function* (workId: string, stage: string) {
	const fleet = yield* Fleet;
	while ((yield* fleet.get(workId)).value.stage !== stage) {
		yield* Effect.yieldNow;
	}
});
describe("Fleet autonomous scheduling", () => {
	const test = it.live.skipIf(storageDatabaseUrl === undefined);
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
	}, 10_000);
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
	}, 10_000);
	test("a human release during pending question publication remains authoritative", function* () {
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
				yield* fleet.resolve("one", decision?.id ?? "missing", "release");
				yield* Deferred.succeed(release, undefined);
				expect((yield* Fiber.join(pending)).value.stage).toBe("released");
				expect((yield* fleet.get("one")).value.stage).toBe("released");
			}),
		);
	}, 10_000);
});
