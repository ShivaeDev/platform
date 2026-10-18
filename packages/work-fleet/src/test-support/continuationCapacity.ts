import { Effect, Option } from "effect";
import { fleetStory } from "#test/fleetStory.ts";

export const continuationCapacity = fleetStory.trait("configuration", "two execution slots", (engine) => {
	engine.options = { ...engine.options, backlog: 4, concurrency: 2 };
});

export const completedContinuation = fleetStory.trait("configuration", "completed results", (engine) => {
	engine.options = { ...engine.options, noChange: true };
});

export const needsHumanContinuation = fleetStory.trait("configuration", "reviewed PRs await a human merge", (engine) => {
	engine.options = { ...engine.options, denyDelivery: true };
});

export const fourApproved = fleetStory.trait("board", "four approved items", (engine) => {
	const { fixture } = Option.getOrThrow(engine.runtime);
	for (const id of ["three", "four"]) {
		fixture.approveWork(id, `board-${id}`);
	}
});

export const singleSlot = fleetStory.trait("configuration", "one execution slot and no-change results", (engine) => {
	engine.options = { ...engine.options, concurrency: 1, noChange: true };
});

export const observedQuota = fleetStory.trait("configuration", "the provider reports fresh quota", (engine) => {
	engine.options = {
		...engine.options,
		refreshQuota: () => Effect.succeed({ available: engine.options.quota ?? 100, expiresAt: Number.MAX_SAFE_INTEGER, observedAt: 0 }),
	};
});
