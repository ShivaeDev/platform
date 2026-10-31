import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeOverrides } from "#rules/suppressions/biomeOverrides.ts";
import { biomeJson } from "#test/biomeConfigFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const FIX = "without a declaration. Repair the code and remove the weakening setting.";

const SWITCHES = [
	["the linter", { linter: { enabled: false } }, "lint"],
	["the recommended rules", { linter: { rules: { recommended: false } } }, "lint/recommended"],
	["the recommended preset", { linter: { rules: { preset: "none" } } }, "lint/recommended"],
	["a group", { linter: { rules: { style: "off" } } }, "lint/style"],
	["a group's recommended rules", { linter: { rules: { a11y: { recommended: false } } } }, "lint/a11y"],
	["a domain", { linter: { domains: { react: "none" } } }, "lint/domains/react"],
	["the assist", { assist: { enabled: false } }, "assist"],
	["the recommended actions", { assist: { actions: { recommended: false } } }, "assist/recommended"],
	["an assist action", { assist: { actions: { source: { useSortedKeys: "off" } } } }, "assist/source/useSortedKeys"],
	["an assist action with options", { assist: { actions: { source: { organizeImports: { level: "off" } } } } }, "assist/source/organizeImports"],
	["the formatter", { formatter: { enabled: false } }, "format"],
	["a language's linter", { css: { linter: { enabled: false } } }, "css/lint"],
	["a language's formatter", { json: { formatter: { enabled: false } } }, "json/format"],
	["a language's assist", { javascript: { assist: { enabled: false } } }, "javascript/assist"],
] as const;

ruleStory.it(
	"suppressions/biome-overrides reports a rule biome.json turns off at its line, for the whole repository",
	[
		repositoryHas({
			content: '{\n\t"linter": {\n\t\t"rules": {\n\t\t\t"complexity": { "useLiteralKeys": "off" }\n\t\t}\n\t}\n}\n',
			path: "biome.json",
		}),
	],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes({
			locations: [locations(), ["biome.json:4"]],
			messages: [messages(), [expect.stringContaining(`Weakens "lint/complexity/useLiteralKeys" for "**" ${FIX}`)]],
		});
	},
);

ruleStory.it(
	"suppressions/biome-overrides reports each rule an override turns down to warn or info, for the override's includes",
	[
		repositoryHas(
			biomeJson({
				overrides: [
					{ includes: ["src/a.ts", "src/b.ts"], linter: { rules: { suspicious: { noExplicitAny: "warn", noThenProperty: { level: "info" } } } } },
				],
			}),
		),
	],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes({
			locations: [locations(), ["biome.json:1", "biome.json:1"]],
			messages: [
				messages(),
				[
					expect.stringContaining(`Weakens "lint/suspicious/noExplicitAny" for "src/a.ts", "src/b.ts" ${FIX}`),
					expect.stringContaining(`Weakens "lint/suspicious/noThenProperty" for "src/a.ts", "src/b.ts" ${FIX}`),
				],
			],
		});
	},
);

for (const [what, config, weakened] of SWITCHES) {
	ruleStory.it(
		`suppressions/biome-overrides reports ${what} switched off at the top level as weakening "${weakened}"`,
		[repositoryHas(biomeJson(config))],
		function* ({ check }) {
			expect(yield* check(biomeOverrides)).toEqual([expect.objectContaining({ subject: weakened })]);
		},
	);

	ruleStory.it(
		`suppressions/biome-overrides reports ${what} switched off in an override as weakening "${weakened}"`,
		[repositoryHas(biomeJson({ overrides: [{ includes: ["src/**"], ...config }] }))],
		function* ({ check }) {
			expect(yield* check(biomeOverrides)).toEqual([expect.objectContaining({ subject: weakened })]);
		},
	);
}

for (const [what, config, weakening] of [
	["excluded files", { files: { includes: ["**", "!**/dist", "!!vendor"] } }, 'Weakens "files/includes" for "**", "!**/dist", "!!vendor"'],
	["files kept from the linter", { linter: { includes: ["**", "!scripts/**"] } }, 'Weakens "lint/includes" for "**", "!scripts/**"'],
	["a linter narrowed to some files", { linter: { includes: ["src/**"] } }, 'Weakens "lint/includes" for "src/**"'],
	["files kept from the formatter", { formatter: { includes: ["**", "!*.md"] } }, 'Weakens "format/includes" for "**", "!*.md"'],
] as const) {
	ruleStory.it(
		`suppressions/biome-overrides reports ${what} with the whole includes list`,
		[repositoryHas(biomeJson(config))],
		function* ({ check, messages }) {
			yield* check(biomeOverrides);

			expect(yield* messages()).toEqual([expect.stringContaining(`${weakening} ${FIX}`)]);
		},
	);
}

ruleStory.it(
	"suppressions/biome-overrides accepts includes lists that keep every file",
	[repositoryHas(biomeJson({ files: { includes: ["**"] }, linter: { includes: ["**"] } }))],
	function* ({ check }) {
		expect(yield* check(biomeOverrides)).toEqual([]);
	},
);

ruleStory.it(
	"suppressions/biome-overrides accepts rules, groups and actions raised, enabled or configured",
	[
		repositoryHas(
			biomeJson({
				assist: { actions: { source: { useSortedKeys: "on" } } },
				formatter: { indentStyle: "tab", lineWidth: 150 },
				linter: { domains: { react: "all" }, rules: { complexity: { noExcessiveCognitiveComplexity: "error" }, preset: "recommended", style: "on" } },
			}),
		),
	],
	function* ({ check }) {
		expect(yield* check(biomeOverrides)).toEqual([]);
	},
);

ruleStory.it(
	"suppressions/biome-overrides reports a weakening in a local file the root biome.json extends, at that file",
	[
		repositoryHas(
			{ content: '{ "extends": ["./biome.base.json"] }', path: "biome.json" },
			biomeJson({ overrides: [{ includes: ["**/*.test.ts"], linter: { rules: { style: { noNonNullAssertion: "off" } } } }] }, "biome.base.json"),
		),
	],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes({
			locations: [locations(), ["biome.base.json:1"]],
			messages: [messages(), [expect.stringContaining(`Weakens "lint/style/noNonNullAssertion" for "**/*.test.ts" ${FIX}`)]],
		});
	},
);

ruleStory.it(
	"suppressions/biome-overrides scopes the weakenings of a nested config below its folder, negated includes too",
	[
		repositoryHas(
			{ content: "{}", path: "biome.json" },
			{
				content:
					'// web\n{ "extends": "//", "linter": { "rules": { "a11y": "off" } }, "overrides": [{ "includes": ["!src/**"], "formatter": { "enabled": false } }] }',
				path: "packages/web/biome.jsonc",
			},
		),
	],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes({
			locations: [locations(), ["packages/web/biome.jsonc:2", "packages/web/biome.jsonc:2"]],
			messages: [messages(), [`Weakens "lint/a11y" for "packages/web/**" ${FIX}`, `Weakens "format" for "!packages/web/src/**" ${FIX}`]],
		});
	},
);

for (const [what, config, location, reason] of [
	["a biome.json that is not JSON", '{ "linter": ', "biome.json", "Expression expected"],
	["a local config biome.json extends that does not exist", '{ "extends": ["./missing.json"] }', "missing.json", "the file does not exist"],
] as const) {
	ruleStory.it(
		`suppressions/biome-overrides reports ${what} as unreadable`,
		[repositoryHas({ content: config, path: "biome.json" })],
		function* ({ check, locations, messages }) {
			yield* check(biomeOverrides);

			yield* outcomes({
				locations: [locations(), [location]],
				messages: [messages(), [`Cannot read this Biome config: ${reason}.`]],
			});
		},
	);
}
