import { Effect } from "effect";
import { expect } from "vitest";
import { storyKit } from "#server/storyKit.ts";

const uninspected = storyKit({
	*create() {
		return { context: yield* Effect.context(), orders: Array.from({ length: 1000 }, () => "rye".repeat(1000)), sacks: 0 };
	},
	name: "uninspected mill",
	stages: [],
	verbs: (engine, story) => ({
		grind: (sacks: number) => {
			story.tell(`the miller grinds ${sacks} sacks`);
			engine.sacks += sacks;
		},
		sacks: () => engine.sacks,
	}),
});

uninspected.it("fails with services and large collections", [], ({ grind, sacks }) => {
	grind(2);

	expect(sacks()).toBe(3);
});
