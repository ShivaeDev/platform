import { expect } from "vitest";
import { counter, INCREMENT, INITIAL_COUNT, incremented, MULTIPLIER } from "#test/counter.ts";
import { lazyVerbStory } from "#test/lazyVerbStory.ts";
import { storyRunner } from "#test/storyRunner.ts";

const FIRST_COUNT = 7;
const SECOND_COUNT = 9;

counter.it("builds the engine through Effect-returning create, trait and after hooks with the kit's layer", [incremented], ({ count }) => {
	expect(count()).toBe((INITIAL_COUNT + INCREMENT) * MULTIPLIER);
});

storyRunner.it("opens Effect-returning hooks in the story Scope and closes them in reverse after the story", [], function* ({ lifetime, runStory }) {
	yield* runStory("lifetimeStories", "Effect Hooks Story: counts with Effect-returning hooks");

	expect(yield* lifetime()).toEqual(["create", "trait", "after", "body", "after closed", "trait closed", "create closed"]);
});

lazyVerbStory.it("leaves verb getters unread until the story reads one", [], ({ getterReads }) => {
	expect(getterReads()).toBe(0);
});

lazyVerbStory.it("reads the current engine each time the story reads a verb getter", [], (verbs) => {
	verbs.setCount(FIRST_COUNT);
	expect(verbs.count).toBe(FIRST_COUNT);

	verbs.setCount(SECOND_COUNT);

	expect(verbs.count).toBe(SECOND_COUNT);
});
