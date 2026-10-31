import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeOverrides } from "#rules/suppressions/biomeOverrides.ts";
import { ACME, acmePackage, extending, weak } from "#test/biomeConfigFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const CONFIGS = { "a.json": weak("a"), "b.json": weak("b"), "configs/strict.json": weak("strict") };

const EXTENDS_ACME_BIOME = { content: '{\n\t"extends": [\n\t\t"@acme/lint/biome"\n\t]\n}', path: "biome.json" };

for (const [how, specifier, manifest, file, weakened] of [
	[
		"the default condition, which Biome accepts, over import",
		"@acme/lint/biome",
		{
			exports: {
				"./biome": Object.fromEntries([
					["import", "./a.json"],
					["default", "./b.json"],
				]),
			},
		},
		"b.json",
		"b",
	],
	["the first condition Biome accepts", "@acme/lint/biome", { exports: { "./biome": { biome: "./a.json", default: "./b.json" } } }, "a.json", "a"],
	["the longest matching exports pattern", "@acme/lint/strict", { exports: { "./*": "./configs/*.json", "./str*": "./a.json" } }, "a.json", "a"],
	[
		"the first usable entry of an exports fallback array",
		"@acme/lint/biome",
		{ exports: { "./biome": [null, { import: "./ignored.json" }, { biome: "./a.json" }] } },
		"a.json",
		"a",
	],
	["a string exports", "@acme/lint", { exports: "./b.json" }, "b.json", "b"],
	["conditions at the top of exports", "@acme/lint", { exports: { default: "./a.json" } }, "a.json", "a"],
	["main without exports", "@acme/lint", { main: "b.json" }, "b.json", "b"],
	["a file path in a package without exports", "@acme/lint/configs/strict.json", {}, "configs/strict.json", "strict"],
] as const) {
	ruleStory.it(
		`suppressions/biome-overrides follows an extends entry through ${how} to ${file} and reports the rule that file turns off`,
		[repositoryHas(extending(specifier), ...acmePackage(manifest, CONFIGS))],
		function* ({ check }) {
			expect(yield* check(biomeOverrides)).toEqual([expect.objectContaining({ subject: `lint/suspicious/${weakened}` })]);
		},
	);
}

ruleStory.it(
	"suppressions/biome-overrides follows an extends entry through the repository's own package.json exports",
	[
		repositoryHas(
			extending("@acme/app/lint"),
			{ content: JSON.stringify({ exports: { "./lint": "./lint.json" }, name: "@acme/app" }), path: "package.json" },
			{ content: weak("own"), path: "lint.json" },
		),
	],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes([
			["locations", () => locations(), ["biome.json:1"]],
			[
				"messages",
				() => messages(),
				[
					'Extends "@acme/app/lint", which weakens "lint/suspicious/own" for "**" without a declaration. Repair the code and restore the check in the preset.',
				],
			],
		]);
	},
);

ruleStory.it(
	"suppressions/biome-overrides reads an extends entry that names a file at the repository root as that file",
	[repositoryHas(extending("configs/base.json"), { content: weak("base"), path: "configs/base.json" })],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes([
			["locations", () => locations(), ["configs/base.json:1"]],
			[
				"messages",
				() => messages(),
				['Weakens "lint/suspicious/base" for "**" without a declaration. Repair the code and remove the weakening setting.'],
			],
		]);
	},
);

ruleStory.it(
	"suppressions/biome-overrides does not follow the extends of an extended config, as Biome does not",
	[
		repositoryHas(
			extending("./base.json", "@acme/lint"),
			{ content: JSON.stringify({ extends: ["./deeper.json"] }), path: "base.json" },
			{ content: weak("deeper"), path: "deeper.json" },
			...acmePackage({ exports: "./biome.json" }, { "biome.json": JSON.stringify({ extends: ["./inner.json"] }), "inner.json": weak("inner") }),
		),
	],
	function* ({ check }) {
		expect(yield* check(biomeOverrides)).toEqual([]);
	},
);

for (const [what, files, message] of [
	["a package that is not installed", [], 'Cannot resolve the Biome config "@acme/lint/biome" from node_modules.'],
	[
		"a subpath the package does not export",
		acmePackage({ exports: { "./other": "./other.json" } }),
		'Cannot resolve the Biome config "@acme/lint/biome"',
	],
	["an export outside the package", acmePackage({ exports: { "./biome": "../x.json" } }), 'Cannot resolve the Biome config "@acme/lint/biome"'],
	[
		"an exported file that does not exist",
		acmePackage({ exports: { "./biome": "./biome.json" } }),
		`Cannot read the Biome config "@acme/lint/biome" at ${ACME}/biome.json: the file does not exist.`,
	],
	[
		"invalid declarations beside the preset",
		acmePackage(
			{ exports: { "./biome": "./biome/biome.json" } },
			{ "biome/biome.json": "{}", "biome/declarations.json": JSON.stringify([{ includes: ["**"], reason: " ", rule: "lint/style" }]) },
		),
		`Cannot read the declarations shipped with "@acme/lint/biome" at ${ACME}/biome/declarations.json:`,
	],
] as const) {
	ruleStory.it(
		`suppressions/biome-overrides reports an extends entry naming ${what} at its line`,
		[repositoryHas(EXTENDS_ACME_BIOME, ...files)],
		function* ({ check, locations, messages }) {
			yield* check(biomeOverrides);

			yield* outcomes([
				["locations", () => locations(), ["biome.json:3"]],
				["messages", () => messages(), [expect.stringContaining(message)]],
			]);
		},
	);
}
