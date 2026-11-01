import { expect } from "vitest";
import { storyKit } from "#storyKit.ts";

const counter = storyKit({
	create: () => ({ count: 0 }),
	name: "counter",
	stages: [],
	verbs: (engine, story) => ({
		count: () => engine.count,
		increment: () => {
			story.tell("the counter increments");
			engine.count += 1;
		},
	}),
});

counter.it("runs without optional engines", [], ({ count, increment }) => {
	increment();

	expect(count()).toBe(1);
});
