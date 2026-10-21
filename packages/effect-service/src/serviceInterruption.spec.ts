import { expect } from "@effect/vitest";
import { Cause, Exit } from "effect";
import { declaresWaitingInitialization, serviceLifetimeStory } from "#test/serviceStory.ts";

serviceLifetimeStory.it(
	"interrupts a method and releases its caller resources while keeping the service live",
	[],
	function* ({ build, close, interrupt, read, startMethod, story }) {
		const service = yield* build();
		const fiber = yield* startMethod(service);
		expect(story.engine.counts.released).toBe(0);
		const exit = yield* interrupt(fiber);
		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		expect(story.engine.counts.released).toBe(1);
		expect(story.engine.counts.finalized).toBe(0);
		expect(yield* read(service)).toBe("resource");
		yield* close();
		expect(story.engine.counts.released).toBe(1);
		expect(story.engine.counts.finalized).toBe(1);
	},
);

serviceLifetimeStory.it(
	"finalizes an interrupted Layer initialization once",
	[declaresWaitingInitialization()],
	function* ({ interrupt, startInitialization, story }) {
		const fiber = yield* startInitialization();
		expect(story.engine.counts.finalized).toBe(0);
		const exit = yield* interrupt(fiber);
		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		expect(story.engine.counts.finalized).toBe(1);
		yield* interrupt(fiber);
		expect(story.engine.counts.finalized).toBe(1);
	},
);
