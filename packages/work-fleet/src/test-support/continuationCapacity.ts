import { Effect } from "effect";
import { running } from "#test/engineState.ts";
import { isolatedEngine } from "#test/engineStory.ts";

export const continuationCapacity = isolatedEngine.trait("configuration", "two execution slots", (engine) => {
	engine.options = { ...engine.options, backlog: 4, concurrency: 2 };
});

export const completedContinuation = isolatedEngine.trait("configuration", "done results", (engine) => {
	engine.options = { ...engine.options, noChange: true };
});

export const needsHumanContinuation = isolatedEngine.trait("configuration", "reviewed PRs await a human merge", (engine) => {
	engine.options = { ...engine.options, denyDelivery: true };
});

export const fourApproved = isolatedEngine.trait("work", "four approved items", (engine) => {
	const { fixture } = running(engine);
	for (const id of ["three", "four"]) {
		fixture.approveWork(id, `board-${id}`);
	}
});

export const singleSlot = isolatedEngine.trait("configuration", "one execution slot and no-change results", (engine) => {
	engine.options = { ...engine.options, concurrency: 1, noChange: true };
});

export const observedQuota = isolatedEngine.trait("configuration", "the provider reports fresh quota", (engine) => {
	engine.options = {
		...engine.options,
		refreshQuota: () => Effect.succeed({ available: engine.options.quota ?? 100, expiresAt: Number.MAX_SAFE_INTEGER, observedAt: 0 }),
	};
});
