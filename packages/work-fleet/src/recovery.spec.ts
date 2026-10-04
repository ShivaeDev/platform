import { Effect, FileSystem } from "effect";
import { expect } from "vitest";
import type { Attempt } from "#domain.ts";
import { Fleet } from "#Fleet.ts";
import { Store } from "#Store.ts";
import { approve, effectApp, outcome, spec } from "./lifecycleFixtures.ts";

effectApp("a persisted prepared intent survives restart and launches the same attempt exactly once", function* (f) {
	yield* Effect.scoped(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped();
			const filename = `${directory}/fleet.sqlite`;
			const attempt: Attempt = {
				createdAt: 0,
				feedback: "",
				id: "attempt-1",
				ref: null,
				result: null,
				revision: null,
				role: "worker",
				status: "prepared",
				workId: "alpha",
			};
			yield* Effect.gen(function* () {
				yield* approve([spec("alpha")]);
				const store = yield* Store;
				yield* store.update((state) =>
					Effect.succeed({ ...state, attempts: [attempt], works: state.works.map((work) => ({ ...work, phase: "working" })) }),
				);
			}).pipe(Effect.provide(f.layer(filename)));
			expect(f.launches).toHaveLength(0);
			yield* Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* fleet.tick();
				yield* fleet.tick();
				expect((yield* fleet.snapshot()).attempts).toHaveLength(1);
				expect(f.launches.map((r) => r.attempt.id)).toEqual(["attempt-1"]);
			}).pipe(Effect.provide(f.layer(filename)));
		}),
	);
});
effectApp("an uncertain acknowledged submission retains identifiers and recovers without replacement", function* (f) {
	yield* Effect.scoped(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped();
			const filename = `${directory}/fleet.sqlite`;
			yield* f.uncertain(true);
			yield* Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* approve([spec("alpha")]);
				yield* fleet.tick();
				const attempt = (yield* fleet.snapshot()).attempts[0];
				expect(attempt?.status).toBe("uncertain");
				expect(attempt?.ref).toEqual({ sessionId: "session-attempt-1", turnId: "turn-attempt-1" });
			}).pipe(Effect.provide(f.layer(filename)));
			yield* f.uncertain(false);
			yield* Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* fleet.tick();
				expect((yield* fleet.snapshot()).attempts[0]?.status).toBe("running");
				expect(f.launches).toHaveLength(1);
				yield* f.finish("attempt-1", outcome());
				yield* fleet.tick();
				expect(f.launches.map((r) => r.attempt.role)).toEqual(["worker", "reviewer"]);
			}).pipe(Effect.provide(f.layer(filename)));
		}),
	);
});
effectApp("a submission without a process handle remains reserved while unrelated work proceeds", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha"), spec("beta")]);
		const store = yield* Store;
		yield* store.update((state) =>
			Effect.succeed({
				...state,
				attempts: [
					{
						createdAt: 0,
						feedback: "",
						id: "attempt-1",
						ref: null,
						result: null,
						revision: null,
						role: "worker",
						status: "submitting",
						workId: "alpha",
					},
				],
				works: state.works.map((work) => (work.spec.id === "alpha" ? { ...work, phase: "working" } : work)),
			}),
		);
		yield* fleet.tick();
		yield* fleet.tick();
		const snapshot = yield* fleet.snapshot();
		expect(snapshot.attempts[0]?.status).toBe("uncertain");
		expect(snapshot.works[0]?.phase).not.toBe("completed");
		expect(snapshot.works[0]?.question).not.toBeNull();
		expect(f.launches.map((r) => r.work.id)).toEqual(["beta"]);
	}).pipe(Effect.provide(f.layer()));
});
