import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const computed = [
	"export const TIMEOUTS = new RegExp('timeout');",
	"export const TIMEOUTS = Schema.Number;",
	"export const TIMEOUTS = Layer.empty;",
	"export const TIMEOUTS = Effect.succeed(5);",
	"export const TIMEOUTS = new Set([5]);",
	"export const TIMEOUTS = Duration.seconds(5);",
	"export const TIMEOUTS = () => 5;",
	"export class TIMEOUTS {}",
	"export const TIMEOUTS = { inspect: Duration.seconds(5) };",
	"export const TIMEOUTS = [Schema.Number];",
];

for (const content of computed) {
	ruleStory.it(
		`files/named-after-export treats ${content} as a runtime export`,
		[repositoryHas({ content, path: "src/timeouts.ts" })],
		function* ({ check, messages }) {
			yield* check(namedAfterExport);

			yield* assertThat(yield* messages(), (actual, expect) =>
				actual.toEqual([expect.stringContaining('"timeouts" does not name its export TIMEOUTS.')]),
			);
		},
	);
}

const misnamed = [
	[
		"src/MaxItems.ts",
		"export const MAX_ITEMS = 10; export function available() {} export function inspect() {}",
		'"MaxItems" exports several things',
	],
	["src/limits.ts", "export const MAX_ITEMS = 10; export function available() { return MAX_ITEMS; }", '"limits" does not name its export available.'],
	[
		"src/test-support/limits.ts",
		"export const MAX_ITEMS = 10; export function available() { return MAX_ITEMS; }",
		'"limits" does not name its export available.',
	],
	["src/MaxItems.ts", "const MAX_ITEMS = 10; export function available() { return MAX_ITEMS; }", '"MaxItems" does not name its export available.'],
	["src/MaxItems.ts", "const MAX_ITEMS = 10;", '"MaxItems" exports nothing'],
] as const;

for (const [path, content, reason] of misnamed) {
	ruleStory.it(
		`files/named-after-export names ${path} by its remaining runtime export: ${content}`,
		[repositoryHas({ content, path })],
		function* ({ check, messages }) {
			yield* check(namedAfterExport);

			yield* assertThat(yield* messages(), (actual, expect) => actual.toEqual([expect.stringContaining(reason)]));
		},
	);
}

const named = [
	["src/available.ts", "export const MAX_ITEMS = 10; export function available() { return MAX_ITEMS; }"],
	["src/available.ts", "const MAX_ITEMS = 10; export function available() { return MAX_ITEMS; }"],
	["src/helpers.ts", "export const MAX_ITEMS = 10; export function available() {} export function inspect() {}"],
	["src/Timeouts.ts", "export const Timeouts = Schema.Number;"],
	["src/Timeouts.ts", "export const Timeouts = Layer.empty;"],
	["src/Timeouts.ts", "export const Timeouts = Duration.seconds(5);"],
] as const;

for (const [path, content] of named) {
	ruleStory.it(
		`files/named-after-export accepts ${path} for its runtime exports: ${content}`,
		[repositoryHas({ content, path })],
		function* ({ check }) {
			const findings = yield* check(namedAfterExport);

			yield* assertThat(findings, (actual) => actual.toEqual([]));
		},
	);
}
