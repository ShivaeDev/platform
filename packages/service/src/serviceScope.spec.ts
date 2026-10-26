import { expect } from "@effect/vitest";
import { Cause, Exit } from "effect";
import { serviceLifetimeStory } from "#test/serviceStory.ts";

serviceLifetimeStory.it(
	"runs initialization finalizers once when the Layer scope is explicitly closed",
	[],
	function* ({ build, close, read, story }) {
		const service = yield* build();
		expect(yield* read(service)).toBe("resource");
		expect(story.engine.counts.finalized).toBe(0);
		yield* close();
		expect(story.engine.operations).toEqual(["finalize initialization"]);
		yield* close();
		expect(story.engine.operations).toEqual(["finalize initialization"]);
	},
);

serviceLifetimeStory.it(
	"runs initialization finalizers once when the live Layer's owner is interrupted",
	[],
	function* ({ interrupt, startOwner, story }) {
		const fiber = yield* startOwner();
		expect(story.engine.counts.finalized).toBe(0);
		const exit = yield* interrupt(fiber);
		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		expect(story.engine.operations).toEqual(["finalize initialization"]);
		yield* interrupt(fiber);
		expect(story.engine.operations).toEqual(["finalize initialization"]);
	},
);
