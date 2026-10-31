import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeRecommends, EXTENDS_QUALITY, qualityPreset } from "#test/biomeConfigFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const PRESET = "node_modules/@shivaedev/quality/biome/preset.json";

const FIX = 'Set it to "error" in the preset and repair the code it reports.';

const RECOMMENDED = biomeRecommends("a11y/useAltText", "suspicious/noDebugger", "suspicious/noExplicitAny");

const ALL_AT_ERROR = {
	a11y: { useAltText: { fix: "none", level: "error" } },
	suspicious: { noDebugger: "error", noExplicitAny: "error" },
};

ruleStory.it(
	"suppressions/biome-recommended accepts a preset that sets every recommended rule to error, as a level or with options",
	[repositoryHas(EXTENDS_QUALITY, ...qualityPreset(ALL_AT_ERROR))],
	function* ({ check }) {
		expect(yield* check(RECOMMENDED)).toEqual([]);
	},
);

ruleStory.it(
	"suppressions/biome-recommended accepts recommended rules whose group the preset sets to error",
	[repositoryHas(EXTENDS_QUALITY, ...qualityPreset({ ...ALL_AT_ERROR, suspicious: "error" }))],
	function* ({ check }) {
		expect(yield* check(RECOMMENDED)).toEqual([]);
	},
);

ruleStory.it(
	"suppressions/biome-recommended reports a recommended rule the preset leaves at Biome's default level, at the preset",
	[repositoryHas(EXTENDS_QUALITY, ...qualityPreset(ALL_AT_ERROR))],
	function* ({ check, locations, messages }) {
		yield* check(biomeRecommends("a11y/useAltText", "suspicious/noDebugger", "suspicious/noExplicitAny", "correctness/noUnusedImports"));

		yield* outcomes([
			["locations", () => locations(), [PRESET]],
			[
				"messages",
				() => messages(),
				[`Biome recommends "lint/correctness/noUnusedImports", which the preset leaves at Biome's default level. ${FIX}`],
			],
		]);
	},
);

ruleStory.it(
	"suppressions/biome-recommended reports each recommended rule the preset sets below error, at its line",
	[repositoryHas(EXTENDS_QUALITY, ...qualityPreset({ ...ALL_AT_ERROR, suspicious: { noDebugger: "warn", noExplicitAny: { level: "off" } } }))],
	function* ({ check, locations, messages }) {
		yield* check(RECOMMENDED);

		yield* outcomes([
			["locations", () => locations(), [`${PRESET}:11`, `${PRESET}:12`]],
			[
				"messages",
				() => messages(),
				[
					`Biome recommends "lint/suspicious/noDebugger", which the preset sets to "warn". ${FIX}`,
					`Biome recommends "lint/suspicious/noExplicitAny", which the preset sets to "off". ${FIX}`,
				],
			],
		]);
	},
);

ruleStory.it(
	"suppressions/biome-recommended accepts a recommended rule below error that the preset declares, and only that rule",
	[
		repositoryHas(
			EXTENDS_QUALITY,
			...qualityPreset({ ...ALL_AT_ERROR, suspicious: { noDebugger: "off", noExplicitAny: "off" } }, [
				{ includes: ["**"], reason: "TypeScript reports it already.", rule: "lint/suspicious/noExplicitAny" },
			]),
		),
	],
	function* ({ check, locations, messages }) {
		yield* check(RECOMMENDED);

		yield* outcomes([
			["locations", () => locations(), [`${PRESET}:11`]],
			["messages", () => messages(), [`Biome recommends "lint/suspicious/noDebugger", which the preset sets to "off". ${FIX}`]],
		]);
	},
);

for (const [what, root] of [
	["has no root Biome config", []],
	["has a root Biome config that extends another config", [{ content: '{ "extends": ["./other.json"] }\n', path: "biome.json" }]],
] as const) {
	ruleStory.it(
		`suppressions/biome-recommended leaves a preset that turns a recommended rule off alone when the repository ${what}`,
		[repositoryHas(...root, ...qualityPreset({ suspicious: { noDebugger: "off" } }))],
		function* ({ check }) {
			expect(yield* check(RECOMMENDED)).toEqual([]);
		},
	);
}

for (const [what, preset, reason] of [
	["is missing", [], "the file does not exist"],
	["is not JSON", [{ content: '{ "linter": ', path: PRESET }], "Expression expected"],
] as const) {
	ruleStory.it(
		`suppressions/biome-recommended reports a resolved preset that ${what}, at the preset`,
		[repositoryHas(EXTENDS_QUALITY, ...qualityPreset(ALL_AT_ERROR).filter((file) => file.path !== PRESET), ...preset)],
		function* ({ check, locations, messages }) {
			yield* check(RECOMMENDED);

			yield* outcomes([
				["locations", () => locations(), [PRESET]],
				["messages", () => messages(), [`Cannot read the preset "@shivaedev/quality/biome/preset.json": ${reason}.`]],
			]);
		},
	);
}

ruleStory.it(
	"suppressions/biome-recommended asks to install Quality when the preset biome.json extends cannot be resolved",
	[repositoryHas(EXTENDS_QUALITY)],
	function* ({ check, locations, messages }) {
		yield* check(RECOMMENDED);

		yield* outcomes([
			["locations", () => locations(), ["biome.json"]],
			[
				"messages",
				() => messages(),
				['Cannot resolve "@shivaedev/quality/biome/preset.json" from node_modules. Install @shivaedev/quality at the repository root.'],
			],
		]);
	},
);

ruleStory.it(
	"suppressions/biome-recommended reports declarations beside the preset that it cannot read, at the declarations",
	[repositoryHas(EXTENDS_QUALITY, ...qualityPreset(ALL_AT_ERROR, [{ includes: ["**"], reason: " ", rule: "lint/suspicious/noDebugger" }]))],
	function* ({ check, locations, messages }) {
		yield* check(RECOMMENDED);

		yield* outcomes([
			["locations", () => locations(), ["node_modules/@shivaedev/quality/biome/declarations.json"]],
			[
				"messages",
				() => messages(),
				[expect.stringMatching(/^Cannot read the declarations shipped with "@shivaedev\/quality\/biome\/preset\.json": /u)],
			],
		]);
	},
);
