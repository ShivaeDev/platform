import { Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { Fleet } from "#Fleet.ts";
import { approve, effectApp, noChange, outcome, review, spec } from "#test/support/lifecycleFixtures.ts";

effectApp("fills capacity, accounts for reviewers, and replaces delivered work", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha", "no-change"), spec("beta"), spec("gamma")]);
		yield* TestClock.adjust("2 seconds");
		yield* fleet.tick();
		expect(f.launches.map((r) => r.work.id)).toEqual(["alpha", "beta"]);
		expect((yield* fleet.snapshot()).attempts[0]?.createdAt).toBe(2000);
		yield* f.finish("attempt-1", noChange);
		yield* fleet.tick();
		expect(f.launches.map((r) => r.attempt.role)).toEqual(["worker", "worker", "reviewer"]);
		expect(f.launches.some((r) => r.work.id === "gamma")).toBe(false);
		yield* f.finish("attempt-3", review());
		yield* fleet.tick();
		expect((yield* fleet.snapshot()).works.find((w) => w.spec.id === "alpha")?.phase).toBe("completed");
		expect(f.launches.at(-1)?.work.id).toBe("gamma");
		expect(f.verifications).toEqual(["alpha"]);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("a scoped hold and ownership conflict leave unrelated eligible work moving", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("held"), spec("alpha"), { ...spec("overlap"), scope: spec("alpha").scope }, spec("free")]);
		yield* fleet.decide("held", "hold", "Await scope clarification");
		yield* fleet.tick();
		expect(f.launches.map((r) => r.work.id)).toEqual(["alpha", "free"]);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("quota, explicit stop, and attempt budget stop new admissions", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha"), spec("beta")]);
		const policy = { capacity: 2, maxAttempts: 1, quotaAvailable: false, stopped: false };
		yield* fleet.policy(policy);
		yield* fleet.tick();
		yield* fleet.policy({ ...policy, quotaAvailable: true, stopped: true });
		yield* fleet.tick();
		expect(f.launches).toHaveLength(0);
		yield* fleet.policy({ ...policy, quotaAvailable: true });
		yield* fleet.tick();
		expect(f.launches).toHaveLength(1);
		yield* f.finish("attempt-1", outcome());
		yield* fleet.tick();
		expect(f.launches).toHaveLength(1);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("structured ownership permits distinct keys but reserves a whole source file", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([
			{ ...spec("one"), scope: [{ key: "one", path: "baseline.json" }] },
			{ ...spec("two"), scope: [{ key: "two", path: "baseline.json" }] },
			{ ...spec("whole"), scope: [{ key: null, path: "baseline.json" }] },
		]);
		yield* fleet.policy({ capacity: 3, maxAttempts: 100, quotaAvailable: true, stopped: false });
		yield* fleet.tick();
		expect(f.launches.map((r) => r.work.id)).toEqual(["one", "two"]);
	}).pipe(Effect.provide(f.layer()));
});
