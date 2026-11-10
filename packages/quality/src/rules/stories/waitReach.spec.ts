import { waitOnEvents } from "#rules/stories/waitOnEvents.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";
import { inStory } from "#testing/storySpecFiles.ts";

for (const load of ['import "./test-support/wait.ts";', 'await import("./test-support/wait.ts");', 'require("./test-support/wait.ts");']) {
	ruleStory.it(
		`tests/wait-on-events follows ${load} and reports shared support only once across cycles and specs`,
		[
			repositoryHas(
				{ content: `${load}\n${inStory("yield* ship();")}`, path: "src/first.spec.ts" },
				{ content: `${load}\n${inStory("yield* ship();")}`, path: "src/second.spec.ts" },
				{ content: 'import "./wait.ts"; export const ship = () => {};', path: "src/test-support/cycle.ts" },
				{
					content: 'import "./cycle.ts"; import { Effect } from "effect"; export const ship = () => Effect.sleep("1 second");',
					path: "src/test-support/wait.ts",
				},
			),
		],
		function* ({ check, locations }) {
			yield* check(waitOnEvents);

			yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/test-support/wait.ts:1"]));
		},
	);
}

for (const [name, load, path] of [
	["unreachable support", "", "src/orders.spec.ts"],
	["type-only support", 'import type { Wait } from "./test-support/wait.ts";', "src/orders.spec.ts"],
	["resolved but unloaded support", 'require.resolve("./test-support/wait.ts");', "src/orders.spec.ts"],
	["a unit test's support", 'import "./test-support/wait.ts";', "src/orders.unit.test.ts"],
	["a typecheck test's support", 'import "./test-support/wait.ts";', "src/orders.typecheck.test.ts"],
] as const) {
	ruleStory.it(
		`tests/wait-on-events leaves ${name} alone`,
		[
			repositoryHas(
				{ content: `${load}\n${inStory("yield* ship();")}`, path },
				{ content: 'import { Effect } from "effect"; export const ship = () => Effect.sleep("1 second");', path: "src/test-support/wait.ts" },
			),
		],
		function* ({ check, findings }) {
			yield* check(waitOnEvents);

			yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
		},
	);
}

ruleStory.it(
	"tests/wait-on-events follows a runtime bridge to nested support while leaving the bridge's product timer alone",
	[
		repositoryHas(
			{ content: `import "./bridge.ts";\n${inStory("yield* ship();")}`, path: "src/orders.spec.ts" },
			{ content: 'import "./test-support/nested/wait.ts"; setTimeout(productExpiry, 1000);', path: "src/bridge.ts" },
			{
				content: 'import { Effect } from "effect"; export const ship = () => Effect.sleep("1 second");',
				path: "src/test-support/nested/wait.ts",
			},
		),
	],
	function* ({ check, locations }) {
		yield* check(waitOnEvents);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/test-support/nested/wait.ts:1"]));
	},
);

ruleStory.it(
	"tests/wait-on-events accepts product timers reached through test-support",
	[
		repositoryHas(
			{ content: `import "./test-support/ship.ts";\n${inStory("yield* ship();")}`, path: "src/orders.spec.ts" },
			{ content: 'export { ship } from "../ship.ts";', path: "src/test-support/ship.ts" },
			{
				content: 'import { Effect } from "effect"; export const ship = () => Effect.sleep("1 day"); setInterval(checkOrders, 1000);',
				path: "src/ship.ts",
			},
		),
	],
	function* ({ check, findings }) {
		yield* check(waitOnEvents);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	},
);
