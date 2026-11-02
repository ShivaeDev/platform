import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeOverrides } from "#rules/suppressions/biomeOverrides.ts";
import { biomeJson } from "#test/biomeConfigFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const REASON = "Vitest reads the fixture's first parameter and needs an object pattern.";

const EMPTY_PATTERN_OFF = biomeJson({
	overrides: [{ includes: ["src/vitest.ts", "src/fixtures.ts"], linter: { rules: { correctness: { noEmptyPattern: "off" } } } }],
});

const NARROW_DECLARATIONS = [
	["lint", ["src/a.ts"]],
	["lint/style", ["src/a.ts"]],
	["lint/domains/react", ["src/a.ts"]],
	["format", ["src/a.ts"]],
	["lint/style/noNonNullAssertion", ["**"]],
	["lint/style/noNonNullAssertion", ["src/**"]],
	["lint/style/noNonNullAssertion", ["src"]],
	["files/includes", ["src/**"]],
	["files/includes", ["**", "!**"]],
	["files/includes", ["**", "!**/*.ts"]],
	["files/includes", ["**", "!**/src/**/*.ts"]],
	["files/includes", ["**", "!src/*.ts"]],
	["files/includes", ["**", "!src/a.ts"]],
	["files/includes", ["**", "!**/src/**"]],
	["files/includes", ["**", "!**/src/*"]],
	["files/includes", ["**", "!**/src/**/*"]],
	["files/includes", ["**", "!**/src/**/generated"]],
	["files/includes", ["**", "!**/src/{generated,fixtures}"]],
	["files/includes", ["**", "!**/src/generated*"]],
	["files/includes", ["**", "!**/src/../generated"]],
	["files/includes", ["**", "!**/src//generated"]],
	["files/includes", ["**", "!!src/generated"]],
] as const;

ruleStory.it(
	"suppressions/biome-overrides takes a weakening as declared when the declaration names its rule and includes in another order",
	[repositoryHas(EMPTY_PATTERN_OFF)],
	function* ({ check }) {
		const findings = yield* check(biomeOverrides, {
			declared: [{ includes: ["src/fixtures.ts", "src/vitest.ts"], reason: REASON, rule: "lint/correctness/noEmptyPattern" }],
		});

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"suppressions/biome-overrides reports a weakening whose declaration names fewer includes, and the declaration as matching nothing",
	[repositoryHas(EMPTY_PATTERN_OFF)],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides, { declared: [{ includes: ["src/vitest.ts"], reason: REASON, rule: "lint/correctness/noEmptyPattern" }] });

		yield* outcomes([
			["locations", () => locations(), ["biome.json:1", "biome.json"]],
			[
				"messages",
				() => messages(),
				[
					expect.stringContaining('Weakens "lint/correctness/noEmptyPattern" for "src/vitest.ts", "src/fixtures.ts" without a declaration.'),
					'Declares "lint/correctness/noEmptyPattern" for "src/vitest.ts", which no Biome config weakens. Remove the declaration.',
				],
			],
		]);
	},
);

ruleStory.it(
	"suppressions/biome-overrides reports a declaration as matching nothing in a repository without a Biome config",
	[repositoryHas({ content: "export const a = 1;\n", path: "src/vitest.ts" })],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides, { declared: [{ includes: ["src/vitest.ts"], reason: REASON, rule: "lint/suspicious/noExplicitAny" }] });

		yield* outcomes([
			["locations", () => locations(), ["biome.json"]],
			[
				"messages",
				() => messages(),
				['Declares "lint/suspicious/noExplicitAny" for "src/vitest.ts", which no Biome config weakens. Remove the declaration.'],
			],
		]);
	},
);

for (const [what, declaration, field] of [
	["a blank reason", { includes: ["src/a.ts"], reason: " ", rule: "lint/style/noNonNullAssertion" }, "reason"],
	["no includes", { includes: [], reason: REASON, rule: "lint/style/noNonNullAssertion" }, "includes"],
	["no rule", { includes: ["src/a.ts"], reason: REASON, rule: "" }, "rule"],
	["an unknown field", { file: "src/a.ts", includes: ["src/a.ts"], reason: REASON, rule: "lint/style/noNonNullAssertion" }, "file"],
] as const) {
	ruleStory.it(`suppressions/biome-overrides refuses a declaration with ${what} and names its ${field}`, [], function* ({ optionIssues }) {
		expect(yield* optionIssues(biomeOverrides, { declared: [declaration] })).toEqual([expect.stringContaining(`declared.0.${field}`)]);
	});
}

for (const [rule, includes] of NARROW_DECLARATIONS) {
	ruleStory.it(
		`suppressions/biome-overrides refuses a declaration of ${rule} for ${JSON.stringify(includes)} as switching off a whole check`,
		[],
		function* ({ optionIssues }) {
			expect(yield* optionIssues(biomeOverrides, { declared: [{ includes, reason: REASON, rule }] })).toEqual([
				expect.stringContaining("Whole checks"),
			]);
		},
	);
}

for (const includes of [
	["**", "!**/test-support/generated", "!**/test-support/*/generated"],
	...["!generated", "!src/generated", "!**/generated", "!**/src/*/generated", "!**/.generated"].map((pattern) => ["**", pattern] as const),
] as const) {
	ruleStory.it(
		`suppressions/biome-overrides accepts a reasoned files/includes declaration that excludes the named directories ${JSON.stringify(includes)}`,
		[],
		function* ({ optionIssues }) {
			expect(
				yield* optionIssues(biomeOverrides, { declared: [{ includes, reason: "Generated code is not source.", rule: "files/includes" }] }),
			).toEqual([]);
		},
	);
}
