import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { waitOnEvents } from "#rules/stories/waitOnEvents.ts";
import { inStory } from "#test/storySpecFiles.ts";

const SPEC = "src/orders.spec.ts";

ruleKit.it(
	"a spec is told to settle on the engine's signal for each sleep, timer, poll, fake timer and clock adjustment",
	[
		repositoryHas({
			content: [
				'import { Effect } from "effect";',
				'import { TestClock } from "effect/testing";',
				'import { vi } from "vitest";',
				'import { eventually } from "@shivaedev/test/eventually.ts";',
				inStory(
					'yield* Effect.sleep("50 millis");',
					"setTimeout(ship, 10);",
					"globalThis.setInterval(poll, 10);",
					'yield* eventually(() => expect(status()).toBe("shipped"));',
					"vi.useFakeTimers();",
					"vi.advanceTimersByTime(1000);",
					'yield* Effect.promise(() => vi.waitFor(() => expect(status()).toBe("shipped")));',
					'yield* TestClock.adjust("1 day");',
					"yield* TestClock.setTime(0);",
				),
			].join("\n"),
			path: SPEC,
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(waitOnEvents);

		expect(findings).toEqual(
			[6, 7, 8, 9, 10, 11, 12, 13, 14].map((line) => ({ file: SPEC, line, message: expect.stringContaining("engine's own signal") })),
		);
	},
);

ruleKit.it(
	"a kit verb that advances the clock, and the spec that calls it, pass",
	[
		repositoryHas(
			{ content: inStory("yield* aDayPasses();", 'expect(yield* status()).toBe("overdue");'), path: SPEC },
			{
				content: 'import { TestClock } from "effect/testing";\nexport const aDayPasses = () => TestClock.adjust("1 day");',
				path: "src/test-support/orders.ts",
			},
		),
	],
	function* ({ checks }) {
		expect(yield* checks(waitOnEvents)).toEqual([]);
	},
);

const POLLING = `import { eventually } from "#eventually.ts";\n${inStory("yield* eventually(() => expect(attempts()).toBe(3));")}`;

ruleKit.it(
	"packages that test-story depends on keep their own timing tests, while other packages are told to settle on events",
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
	function* ({ checks }) {
		const findings = yield* checks(waitOnEvents);

		expect(findings.map(({ file }) => file)).toEqual(["packages/orders/src/orders.spec.ts"]);
	},
);
