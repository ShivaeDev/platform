import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#Fleet.ts";
import { failure } from "#ports.ts";
import { Store } from "#Store.ts";
import { approve, effectApp, outcome, pullRequest, review, spec } from "./lifecycleFixtures.ts";

effectApp("an ordinary merge advancing the base completes without a repair execution", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* fleet.decide("alpha", "merge", "Ordinary merge after current review");
		yield* fleet.tick();
		yield* f.finish("attempt-1", outcome());
		yield* fleet.tick();
		yield* f.finish("attempt-2", review());
		yield* fleet.tick();
		yield* f.observePr({ ...pullRequest(), baseRevision: "merged-base", state: "merged" });
		yield* fleet.tick();
		expect((yield* fleet.snapshot()).works[0]?.phase).toBe("completed");
		expect(f.launches).toHaveLength(2);
		expect(f.merges).toEqual(["alpha"]);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("a branch outcome cannot silently expand a no-change approval", function* (f) {
	let publications = 0;
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha", "no-change")]);
		yield* fleet.tick();
		yield* f.finish("attempt-1", { kind: "outcome", outcome: { kind: "branch", revision: "head-1" } });
		yield* fleet.tick();
		yield* fleet.tick();
		const state = yield* fleet.snapshot();
		expect(state.works[0]?.phase).toBe("held");
		expect(state.works[0]?.publish).toBe("none");
		expect(state.works[0]?.question?.question).toContain("code change authorized");
		expect(f.launches).toHaveLength(1);
		expect(publications).toBe(0);
	}).pipe(
		Effect.provide(
			f.layer(":memory:", "test", {
				publish: () =>
					Effect.sync(() => {
						publications += 1;
						return { kind: "pull-request", number: 1, revision: "head-1", url: pullRequest().url };
					}),
			}),
		),
	);
});
effectApp("lowered capacity leaves a prepared intent durable while another attempt runs", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* fleet.accept({ id: "batch", works: [spec("alpha"), spec("beta")] });
		yield* fleet.decide("alpha", "approve", "Approve alpha");
		yield* fleet.tick();
		yield* fleet.decide("beta", "approve", "Approve beta");
		const store = yield* Store;
		yield* store.update((state) =>
			Effect.succeed({
				...state,
				attempts: [
					...state.attempts,
					{
						createdAt: 0,
						feedback: "",
						id: "attempt-2",
						ref: null,
						result: null,
						revision: null,
						role: "worker",
						status: "prepared",
						workId: "beta",
					},
				],
				works: state.works.map((work) => (work.spec.id === "beta" ? { ...work, phase: "working" } : work)),
			}),
		);
		yield* fleet.policy({ capacity: 1, maxAttempts: 100, quotaAvailable: true, stopped: false });
		yield* fleet.tick();
		expect((yield* fleet.snapshot()).attempts[1]?.status).toBe("prepared");
		expect(f.launches.map((r) => r.work.id)).toEqual(["alpha"]);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("canonical checkout aliases and repository case cannot evade writer ownership", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([
			spec("alpha"),
			{ ...spec("alias"), checkout: `${spec("alpha").checkout}/.` },
			{ ...spec("case"), repository: "Example/Project", scope: spec("alpha").scope },
			spec("free"),
		]);
		yield* fleet.policy({ capacity: 4, maxAttempts: 100, quotaAvailable: true, stopped: false });
		yield* fleet.tick();
		const state = yield* fleet.snapshot();
		expect(state.works[0]?.spec.checkout).toBe(state.works[1]?.spec.checkout);
		expect(state.works[2]?.spec.repository).toBe("example/project");
		expect(f.launches.map((r) => r.work.id)).toEqual(["alpha", "free"]);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("a known publication preflight refusal repairs in the original worker session", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* fleet.tick();
		yield* f.finish("attempt-1", { kind: "outcome", outcome: { kind: "branch", revision: "head-1" } });
		yield* fleet.tick();
		yield* f.finish("attempt-2", review());
		yield* fleet.tick();
		expect((yield* fleet.snapshot()).works[0]?.publish).toBe("none");
		expect(f.launches.at(-1)?.attempt.role).toBe("worker");
		expect(f.launches.at(-1)?.attempt.ref?.sessionId).toBe("session-attempt-1");
		expect(f.launches.at(-1)?.attempt.feedback).toBe("Scoped preflight validation failed");
	}).pipe(Effect.provide(f.layer(":memory:", "test", { publish: () => Effect.fail(failure("Scoped preflight validation failed", "repair")) })));
});
effectApp("an uncertain publication response stays reserved without repeating publication", function* (f) {
	let publications = 0;
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* fleet.tick();
		yield* f.finish("attempt-1", { kind: "outcome", outcome: { kind: "branch", revision: "head-1" } });
		yield* fleet.tick();
		yield* f.finish("attempt-2", review());
		yield* fleet.tick();
		yield* fleet.tick();
		expect((yield* fleet.snapshot()).works[0]?.publish).toBe("uncertain");
		expect(publications).toBe(1);
		expect(f.launches).toHaveLength(2);
	}).pipe(
		Effect.provide(
			f.layer(":memory:", "test", {
				publish: () =>
					Effect.gen(function* () {
						publications += 1;
						return yield* Effect.fail(failure("Connection lost after publication request", "uncertain"));
					}),
			}),
		),
	);
});
