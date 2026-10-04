import { Effect, FileSystem } from "effect";
import { expect } from "vitest";
import { Fleet } from "./Fleet.ts";
import { approve, effectApp, spec } from "./lifecycleFixtures.ts";
import { Store } from "./Store.ts";

effectApp("an operator can attach a missing receipt without replacing a known provider identity", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* f.uncertain(true);
		yield* fleet.tick();
		const wrong = yield* fleet
			.recover("attempt-1", { sessionId: "unrelated", turnId: "turn-unrelated" }, "Inspected provider receipt")
			.pipe(Effect.result);
		expect(wrong._tag).toBe("Failure");
		const rejected = yield* fleet.recover("attempt-1", null, "Claimed absent").pipe(Effect.result);
		expect(rejected._tag).toBe("Failure");
		yield* fleet.recover("attempt-1", { sessionId: "session-attempt-1", turnId: "turn-attempt-1" }, "Matched the exact provider receipt");
		const state = yield* fleet.snapshot();
		expect(state.decisions.at(-1)?.action).toBe("attach");
		expect(state.decisions.at(-1)?.attemptId).toBe("attempt-1");
		expect(state.attempts[0]?.status).toBe("accepted");
		yield* fleet.tick();
		expect(f.launches).toHaveLength(1);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("confirmed absence releases an uncertain intent and records the operator decision", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
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
						status: "uncertain",
						workId: "alpha",
					},
				],
			}),
		);
		yield* fleet.recover("attempt-1", null, "Provider administrator confirmed the request was never submitted");
		yield* fleet.tick();
		const snapshot = yield* fleet.snapshot();
		expect(snapshot.attempts[0]?.status).toBe("failed");
		expect(snapshot.decisions.at(-1)?.action).toBe("reject-submission");
		expect(f.launches.map((request) => request.attempt.id)).toEqual(["attempt-2"]);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("the database has one process owner and cannot be placed inside an approved worker checkout", function* (f) {
	yield* Effect.scoped(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped();
			const database = `${directory}/fleet.sqlite`;
			yield* Effect.gen(function* () {
				const fleet = yield* Fleet;
				const bad = yield* fleet.accept({ id: "bad", works: [{ ...spec("alpha"), checkout: directory }] }).pipe(Effect.result);
				expect(bad._tag).toBe("Failure");
				expect((yield* fleet.snapshot()).works).toHaveLength(0);
				const competing = yield* Effect.gen(function* () {
					return yield* (yield* Fleet).snapshot();
				}).pipe(Effect.provide(f.layer(database)), Effect.result);
				expect(competing._tag).toBe("Failure");
			}).pipe(Effect.provide(f.layer(database)));
			yield* Effect.gen(function* () {
				expect((yield* (yield* Fleet).snapshot()).works).toHaveLength(0);
			}).pipe(Effect.provide(f.layer(database)));
		}),
	);
});
