import { expect } from "@effect/vitest";
import { boardFileStory } from "#test/boardFileStory.ts";
import { healthSnapshot } from "#test/health.ts";

boardFileStory.it("reloads scheduler and capacity observations after a host restart", [], function* ({ health }) {
	yield* health.publish(healthSnapshot);
	const restored = yield* health.restore();
	expect(restored).toEqual({ lastCapacityRejection: healthSnapshot.lastCapacityRejection, lastSchedulerPass: healthSnapshot.lastSchedulerPass });
});

boardFileStory.it("does not republish legacy raw provider text after restart", [], function* ({ health }) {
	yield* health.publish({ ...healthSnapshot, lastCapacityRejection: { at: 800, cause: "Private upstream text" } });
	const restored = yield* health.restore();
	expect(restored).toEqual({ lastCapacityRejection: null, lastSchedulerPass: healthSnapshot.lastSchedulerPass });
});
