import { expect } from "vitest";
import { clientInitializer, firstDeployment, urlInitializer } from "#test/initializerStories.ts";

for (const [kit, initializer] of [
	[urlInitializer, "an initializer given the template URL"],
	[clientInitializer, "an initializer Effect using the supplied SQL client"],
] as const) {
	kit.it(`${initializer} prepares the story's starting state, and the fixtures run after it`, [], function* ({ appState }) {
		expect(yield* appState()).toEqual(["ready"]);
	});
}

urlInitializer.it("the initializer's resources are released before a story starts", [], function* ({ initializerResources }) {
	expect(yield* initializerResources()).toBe("released");
});

urlInitializer.it("every story sees the initializer and the fixtures run once for the whole worker", [], function* ({ preparationRuns }) {
	expect(yield* preparationRuns()).toEqual({ fixtures: 1, initializer: 1 });
});

urlInitializer.it("a first-deployment story on the empty template has no tables", [firstDeployment], function* ({ tables }) {
	expect(yield* tables()).toEqual([]);
});
