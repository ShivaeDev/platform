import { expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { serviceFailureStory } from "#test/serviceStory.ts";

serviceFailureStory.it(
	"fails the Layer build with the initializer error and finalizes its partial acquisition",
	[],
	function* ({ buildFailedInitialization, story }) {
		expect(yield* buildFailedInitialization()).toBe(story.engine.initializationFailure);
		expect(story.engine.counts.finalized).toBe(1);
		expect(story.engine.counts.factoryCalls).toBe(0);
	},
);

serviceFailureStory.it(
	"returns a method's typed failure to the caller and serves the next call on the same instance",
	[],
	function* ({ buildFailedMethod, run, story }) {
		const service = yield* buildFailedMethod();
		expect(yield* run(service, true).pipe(Effect.flip)).toBe(story.engine.methodFailure);
		expect(yield* run(service, false)).toBe("call 2");
	},
);

serviceFailureStory.it("keeps a method defect in the defect channel", [], function* ({ crash, story }) {
	expect(yield* crash()).toEqual(Exit.die(story.engine.defect));
});
