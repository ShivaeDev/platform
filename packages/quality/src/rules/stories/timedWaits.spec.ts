import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { waitOnEvents } from "#rules/stories/waitOnEvents.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { inStory } from "#test/storySpecFiles.ts";

const SPEC = "src/orders.spec.ts";

const VI = 'import { vi } from "vitest";';
const TEST_CLOCK = 'import { TestClock } from "effect/testing";';
const NO_IMPORT = 'import { expect } from "vitest";';

for (const [imports, wait] of [
	['import { Effect } from "effect";', 'yield* Effect.sleep("50 millis");'],
	[NO_IMPORT, "setTimeout(ship, 10);"],
	[NO_IMPORT, "globalThis.setInterval(poll, 10);"],
	['import { eventually } from "@shivaedev/test/eventually.ts";', 'yield* eventually(() => expect(status()).toBe("shipped"));'],
	[VI, "vi.useFakeTimers();"],
	[VI, "vi.advanceTimersByTime(1000);"],
	[VI, 'yield* Effect.promise(() => vi.waitFor(() => expect(status()).toBe("shipped")));'],
	[TEST_CLOCK, 'yield* TestClock.adjust("1 day");'],
	[TEST_CLOCK, "yield* TestClock.setTime(0);"],
] as const) {
	ruleStory.it(
		`tests/wait-on-events reports ${wait} in a story and asks to settle on the engine's signal`,
		[repositoryHas({ content: `${imports}\n${inStory(wait)}`, path: SPEC })],
		function* ({ check, locations, messages }) {
			yield* check(waitOnEvents);

			yield* outcomes([
				["advice", () => messages(), [expect.stringContaining("Settle on the engine's own signal through a kit verb")]],
				["locations", () => locations(), [`${SPEC}:3`]],
			]);
		},
	);
}

const POLLING = `import { eventually } from "#eventually.ts";\n${inStory("yield* eventually(() => expect(attempts()).toBe(3));")}`;

ruleStory.it(
	"tests/wait-on-events leaves the polling story of a package test-story depends on alone and reports the same story elsewhere",
	[
		repositoryHas(
			{ content: '{"workspaces":["packages/*"]}', path: "package.json" },
			{ content: '{"name":"@shivaedev/test-story","dependencies":{"@shivaedev/test":"workspace:*"}}', path: "packages/test-story/package.json" },
			{ content: '{"name":"@shivaedev/test"}', path: "packages/test/package.json" },
			{ content: POLLING, path: "packages/test/src/eventually.spec.ts" },
			{ content: '{"name":"@example/orders"}', path: "packages/orders/package.json" },
			{ content: POLLING, path: "packages/orders/src/orders.spec.ts" },
		),
	],
	function* ({ check, locations }) {
		yield* check(waitOnEvents);

		expect(yield* locations()).toEqual(["packages/orders/src/orders.spec.ts:3"]);
	},
);
