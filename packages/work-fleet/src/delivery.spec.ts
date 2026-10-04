import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#Fleet.ts";
import { renderViews } from "#renderViews.ts";
import { approve, effectApp, noChange, outcome, pullRequest, review, spec } from "./lifecycleFixtures.ts";

effectApp("independent review requests repair in the original worker session before ordinary merge", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* fleet.decide("alpha", "merge", "Allow ordinary merge after review and required checks");
		yield* fleet.tick();
		yield* f.finish("attempt-1", outcome());
		yield* fleet.tick();
		expect(f.launches[1]?.attempt.ref).toBeNull();
		yield* f.finish("attempt-2", review("repair"));
		yield* fleet.tick();
		expect(f.launches[2]?.attempt.ref).toEqual({ sessionId: "session-attempt-1", turnId: null });
		expect(f.launches[2]?.attempt.feedback).toBe("Correct the edge case");
		yield* f.observePr(pullRequest("head-2"));
		yield* f.finish("attempt-3", outcome("head-2"));
		yield* fleet.tick();
		yield* f.finish("attempt-4", review("approve", "head-2"));
		yield* fleet.tick();
		expect(f.merges).toEqual(["alpha"]);
		expect((yield* fleet.snapshot()).works[0]?.phase).toBe("delivery");
		expect((yield* fleet.snapshot()).works[0]?.merge).toBe("acknowledged");
		yield* f.observePr({ ...pullRequest("head-2"), state: "merged" });
		yield* fleet.tick();
		expect((yield* fleet.snapshot()).works[0]?.phase).toBe("completed");
		yield* fleet.tick();
		expect(f.merges).toHaveLength(1);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("a changed head invalidates old review and checks before delivery", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* fleet.decide("alpha", "merge", "Approved ordinary merge");
		yield* fleet.tick();
		yield* f.finish("attempt-1", outcome());
		yield* fleet.tick();
		yield* f.finish("attempt-2", review());
		yield* f.observePr({ ...pullRequest("head-2"), checks: [{ name: "test", status: "pending" }] });
		yield* fleet.tick();
		const state = yield* fleet.snapshot();
		expect(state.works[0]?.review).toBeNull();
		expect(state.works[0]?.observation?.checks[0]?.status).toBe("pending");
		expect(f.launches.at(-1)?.attempt.revision).toBe("head-2");
		yield* f.finish("attempt-3", review("approve", "head-2"));
		yield* fleet.tick();
		expect(f.merges).toHaveLength(0);
		yield* f.observePr(pullRequest("head-2"));
		yield* fleet.tick();
		expect(f.merges).toEqual(["alpha"]);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("failed required checks become worker repair and an advanced base requires integration", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* fleet.tick();
		yield* f.finish("attempt-1", outcome());
		yield* f.observePr({ ...pullRequest(), checks: [{ name: "test", status: "failed" }] });
		yield* fleet.tick();
		expect(f.launches.at(-1)?.attempt.role).toBe("worker");
		expect(f.launches.at(-1)?.attempt.ref?.sessionId).toBe("session-attempt-1");
		yield* f.finish("attempt-2", outcome("head-2"));
		yield* f.observePr({ ...pullRequest("head-2"), baseRevision: "base-2" });
		yield* fleet.tick();
		expect(f.launches.at(-1)?.attempt.role).toBe("worker");
		expect(f.launches.at(-1)?.attempt.feedback).toContain("base advanced");
	}).pipe(Effect.provide(f.layer()));
});
effectApp("no-change needs declared completion, independent review, and host verification", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha", "no-change")]);
		yield* fleet.tick();
		yield* f.finish("attempt-1", noChange);
		yield* fleet.tick();
		expect(f.verifications).toHaveLength(0);
		expect((yield* fleet.snapshot()).works[0]?.phase).toBe("reviewing");
		yield* f.finish("attempt-2", review());
		yield* fleet.tick();
		const state = yield* fleet.snapshot();
		expect(f.verifications).toEqual(["alpha"]);
		expect(state.works[0]?.phase).toBe("completed");
		const views = renderViews(state);
		expect(views.Completed).toContain("## alpha");
		expect(views.Completed).toContain("requested behavior already exists");
		expect(views.Active).not.toContain("## alpha");
		expect(views.NeedsHuman).toContain("No items");
	}).pipe(Effect.provide(f.layer()));
});
