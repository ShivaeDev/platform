import { expect } from "@effect/vitest";
import { boardFileStory } from "#test/boardFileStory.ts";
import { healthSnapshot } from "#test/health.ts";

boardFileStory.it("a restarted host reloads the last scheduler pass and capacity rejection from published health", [], function* ({ health }) {
	yield* health.publish(healthSnapshot);

	const restored = yield* health.restore();

	expect(restored).toEqual({ lastCapacityRejection: healthSnapshot.lastCapacityRejection, lastSchedulerPass: healthSnapshot.lastSchedulerPass });
});

boardFileStory.it("a restarted host drops a capacity rejection that holds raw provider text", [], function* ({ health }) {
	yield* health.publish({ ...healthSnapshot, lastCapacityRejection: { at: 800, cause: "Private upstream text" } });

	const restored = yield* health.restore();

	expect(restored).toEqual({ lastCapacityRejection: null, lastSchedulerPass: healthSnapshot.lastSchedulerPass });
});
