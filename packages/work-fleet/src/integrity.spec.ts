import { Effect, FileSystem } from "effect";
import { expect } from "vitest";
import { Fleet } from "#Fleet.ts";
import { approve, effectApp, outcome, pullRequest, review, spec } from "#test/support/lifecycleFixtures.ts";

effectApp("a provider cannot use the worker session for independent review", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* fleet.tick();
		yield* f.reviewerSession("session-attempt-1");
		yield* f.finish("attempt-1", outcome());
		yield* fleet.tick();
		yield* f.finish("attempt-2", review());
		yield* fleet.tick();
		const state = yield* fleet.snapshot();
		expect(state.works[0]?.review).toBeNull();
		expect(state.works[0]?.phase).not.toBe("completed");
		expect(state.works[0]?.question?.recommendation).toContain("separate provider session");
		expect(f.merges).toHaveLength(0);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("observations cannot replace a durable provider identity", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* fleet.tick();
		yield* f.observeAttempt("attempt-1", {
			ref: { sessionId: "unrelated-session", turnId: "unrelated-turn" },
			result: outcome(),
			status: "completed",
		});
		yield* fleet.tick();
		const state = yield* fleet.snapshot();
		expect(state.attempts[0]?.ref?.sessionId).toBe("session-attempt-1");
		expect(state.works[0]?.outcome).toBeNull();
		expect(state.works[0]?.question?.recommendation).toContain("durable attempt identity");
		expect(f.launches).toHaveLength(1);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("a database refuses a different backend after restart before dispatch", function* (f) {
	yield* Effect.scoped(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped();
			const filename = `${directory}/fleet.sqlite`;
			yield* Effect.gen(function* () {
				yield* approve([spec("alpha")]);
				yield* (yield* Fleet).tick();
			}).pipe(Effect.provide(f.layer(filename)));
			yield* Effect.gen(function* () {
				const fleet = yield* Fleet;
				expect((yield* fleet.tick().pipe(Effect.result))._tag).toBe("Failure");
				expect((yield* fleet.snapshot()).backend).toBe("test/test");
				expect(f.launches).toHaveLength(1);
			}).pipe(Effect.provide(f.layer(filename, "different")));
		}),
	);
});
effectApp("duplicate required check names cannot hide a failing result", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha", "pull-request")]);
		yield* fleet.tick();
		yield* f.finish("attempt-1", outcome());
		yield* fleet.tick();
		yield* f.finish("attempt-2", review());
		yield* f.observePr({
			...pullRequest(),
			checks: [
				{ name: "test", status: "passed" },
				{ name: "test", status: "failed" },
			],
		});
		yield* fleet.tick();
		expect((yield* fleet.snapshot()).works[0]?.phase).not.toBe("completed");
		expect(f.launches.at(-1)?.attempt.role).toBe("worker");
		expect(f.merges).toHaveLength(0);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("PR completion verifies the scoped change and never requests a merge", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha", "pull-request")]);
		yield* fleet.tick();
		yield* f.finish("attempt-1", outcome());
		yield* fleet.tick();
		expect(f.changeVerifications).toHaveLength(0);
		yield* f.finish("attempt-2", review());
		yield* fleet.tick();
		expect(f.changeVerifications).toEqual(["alpha"]);
		expect((yield* fleet.snapshot()).works[0]?.phase).toBe("completed");
		expect(f.merges).toHaveLength(0);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("a stored approval for an old PR head cannot authorize a changed head", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* fleet.tick();
		yield* f.finish("attempt-1", outcome());
		yield* fleet.tick();
		yield* f.finish("attempt-2", review());
		yield* fleet.tick();
		expect((yield* fleet.snapshot()).works[0]?.review?.revision).toBe("head-1");
		yield* fleet.decide("alpha", "merge", "Ordinary merge authority still requires current evidence");
		yield* f.observePr(pullRequest("head-2"));
		yield* fleet.tick();
		expect((yield* fleet.snapshot()).works[0]?.review).toBeNull();
		expect(f.launches.at(-1)?.attempt.revision).toBe("head-2");
		expect(f.merges).toHaveLength(0);
	}).pipe(Effect.provide(f.layer()));
});
