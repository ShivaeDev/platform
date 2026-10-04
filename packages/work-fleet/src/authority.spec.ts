import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#Fleet.ts";
import { renderViews } from "#renderViews.ts";
import { approve, effectApp, noChange, outcome, review, spec } from "#test/support/lifecycleFixtures.ts";

effectApp("admissions and merges require separate decisions scoped to the exact work", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* fleet.accept({ id: "batch", works: [spec("alpha"), spec("beta")] });
		yield* fleet.tick();
		expect(f.launches).toHaveLength(0);
		expect((yield* fleet.decide("missing", "approve", "Scope approval").pipe(Effect.result))._tag).toBe("Failure");
		expect((yield* fleet.decide("alpha", "approve", " ").pipe(Effect.result))._tag).toBe("Failure");
		yield* fleet.decide("alpha", "approve", "Approved alpha only");
		yield* fleet.decide("beta", "merge", "Does not authorize alpha");
		yield* fleet.tick();
		yield* f.finish("attempt-1", outcome());
		yield* fleet.tick();
		yield* f.finish("attempt-2", review());
		yield* fleet.tick();
		expect(f.launches.map((r) => r.work.id)).toEqual(["alpha", "alpha"]);
		expect(f.merges).toHaveLength(0);
		const state = yield* fleet.snapshot();
		expect(state.works[0]?.question?.question).toContain("Authorize ordinary merge");
		const views = renderViews(state);
		expect(views.NeedsHuman).toContain("Question:");
		expect(views.NeedsHuman).toContain("Context:");
		expect(views.NeedsHuman).toContain("Recommendation:");
		expect(views.NeedsHuman).toContain("https://github.com/example/project/pull/1");
		expect(views.Completed).toContain("No items");
		yield* fleet.decide("alpha", "merge", "Allow this reviewed scope");
		yield* fleet.tick();
		expect(f.merges).toEqual(["alpha"]);
	}).pipe(Effect.provide(f.layer()));
});
effectApp("an agent no-change report cannot change a declared PR completion condition", function* (f) {
	yield* Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* approve([spec("alpha")]);
		yield* fleet.tick();
		yield* f.finish("attempt-1", noChange);
		yield* fleet.tick();
		yield* f.finish("attempt-2", review());
		yield* fleet.tick();
		expect((yield* fleet.snapshot()).works[0]?.phase).toBe("held");
		expect(f.verifications).toHaveLength(0);
		expect(f.merges).toHaveLength(0);
	}).pipe(Effect.provide(f.layer()));
});
