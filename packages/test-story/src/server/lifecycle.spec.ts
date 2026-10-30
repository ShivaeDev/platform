import { expect } from "vitest";
import { lifetime } from "#test/lifetime.ts";
import { storyRunner } from "#test/storyRunner.ts";

const RESOURCE_LIFETIME = ["enter", "engine", "trait", "after", "body", "exit", "after closed", "trait closed", "engine closed"];

for (const [ending, name] of [
	["passes", "Lifetime Story: passes with a scoped resource"],
	["fails", "Lifetime Story: fails with a scoped resource"],
] as const) {
	storyRunner.it(
		`wraps creation, traits, after hooks and body in around and closes their resources in reverse when the story ${ending}`,
		[],
		function* ({ lifetime: lifetimeOf, runStory }) {
			yield* runStory("lifetimeStories", name);

			expect(yield* lifetimeOf()).toEqual(RESOURCE_LIFETIME);
		},
	);
}

lifetime.it("runs a live kit's story on the live clock", [], function* ({ clock }) {
	expect(yield* clock()).toBe("the live clock");
});

lifetime.it(
	"runs a live kit's story on the test clock when the story asks for it",
	[],
	function* ({ clock }) {
		expect(yield* clock()).toBe("the test clock at zero");
	},
	{ clock: "test" },
);
