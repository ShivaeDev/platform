import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeOverrides } from "#rules/suppressions/biomeOverrides.ts";
import { acmePreset, consumer, off } from "#test/biomeConfigFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const REASON = "Tools load their config files through the default export.";

const CONFIG_FILES = { includes: ["**/*.config.ts"], linter: { rules: { style: { noDefaultExport: "off" } } } };

const SHIPPED = [{ includes: ["**/*.config.ts"], reason: REASON, rule: "lint/style/noDefaultExport" }];

const EXTENDS_ACME = consumer({});

const PRESET_FIX = "without a declaration. Repair the code and restore the check in the preset.";

const CONSUMER_FIX = "without a declaration. Repair the code and remove the weakening setting.";

ruleStory.it(
	"suppressions/biome-overrides takes a weakening that the preset declares beside itself as declared",
	[repositoryHas(...acmePreset({ overrides: [CONFIG_FILES] }, SHIPPED), EXTENDS_ACME)],
	function* ({ check }) {
		expect(yield* check(biomeOverrides)).toEqual([]);
	},
);

ruleStory.it(
	"suppressions/biome-overrides reports a weakening the preset does not declare at the consumer's extends line",
	[repositoryHas(...acmePreset({ ...off("suspicious", "noConsole"), overrides: [CONFIG_FILES] }, SHIPPED), EXTENDS_ACME)],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes({
			locations: [locations(), ["biome.json:3"]],
			messages: [messages(), [`Extends "@acme/lint/biome", which weakens "lint/suspicious/noConsole" for "**" ${PRESET_FIX}`]],
		});
	},
);

ruleStory.it(
	"suppressions/biome-overrides reports the weakenings of a preset that ships no declarations at the consumer's extends line",
	[repositoryHas(...acmePreset({ overrides: [CONFIG_FILES] }), EXTENDS_ACME)],
	function* ({ check, messages }) {
		yield* check(biomeOverrides);

		expect(yield* messages()).toEqual([`Extends "@acme/lint/biome", which weakens "lint/style/noDefaultExport" for "**/*.config.ts" ${PRESET_FIX}`]);
	},
);

ruleStory.it(
	"suppressions/biome-overrides still asks the consumer to declare a weakening the preset declares for other files",
	[
		repositoryHas(
			...acmePreset({ overrides: [CONFIG_FILES] }, SHIPPED),
			consumer({ overrides: [{ includes: ["scripts/**"], linter: { rules: { style: { noDefaultExport: "off" } } } }] }),
		),
	],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes({
			locations: [locations(), ["biome.json:13"]],
			messages: [messages(), [expect.stringContaining(`Weakens "lint/style/noDefaultExport" for "scripts/**" ${CONSUMER_FIX}`)]],
		});
	},
);

ruleStory.it(
	"suppressions/biome-overrides asks the consumer to declare a weakening its own config adds to the preset",
	[repositoryHas(...acmePreset({}, []), consumer({ linter: { rules: { suspicious: { noConsole: "warn" } } } }))],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes({
			locations: [locations(), ["biome.json:8"]],
			messages: [messages(), [expect.stringContaining(`Weakens "lint/suspicious/noConsole" for "**" ${CONSUMER_FIX}`)]],
		});
	},
);

for (const [what, preset, config] of [
	["a rule", off("suspicious", "noConsole"), { linter: { rules: { suspicious: { noConsole: "error" } } } }],
	["a rule, with a level", off("suspicious", "noConsole"), { linter: { rules: { suspicious: { noConsole: { level: "error" } } } } }],
	["a rule, through its whole group", off("suspicious", "noConsole"), { linter: { rules: { suspicious: "error" } } }],
	["the recommended rules", { linter: { rules: { recommended: false } } }, { linter: { rules: { recommended: true } } }],
	["the linter", { linter: { enabled: false } }, { linter: { enabled: true } }],
] as const) {
	ruleStory.it(
		`suppressions/biome-overrides accepts a consumer that turns ${what} the preset turned off back on`,
		[repositoryHas(...acmePreset(preset, []), consumer(config))],
		function* ({ check }) {
			expect(yield* check(biomeOverrides)).toEqual([]);
		},
	);
}

ruleStory.it(
	"suppressions/biome-overrides keeps reporting a group the preset turns off when the consumer turns one of its rules on",
	[
		repositoryHas(
			...acmePreset({ linter: { rules: { suspicious: "off" } } }, []),
			consumer({ linter: { rules: { suspicious: { noConsole: "error" } } } }),
		),
	],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes({
			locations: [locations(), ["biome.json:3"]],
			messages: [messages(), [`Extends "@acme/lint/biome", which weakens "lint/suspicious" for "**" ${PRESET_FIX}`]],
		});
	},
);

ruleStory.it(
	"suppressions/biome-overrides keeps the preset's files.includes beside the consumer's, since Biome appends the lists",
	[
		repositoryHas(
			...acmePreset({ files: { includes: ["**", "!**/generated"] } }, [
				{ includes: ["**", "!**/generated"], reason: "Generated code is not source.", rule: "files/includes" },
			]),
			consumer({ files: { includes: ["**", "!vendor"] } }),
		),
	],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes({
			locations: [locations(), ["biome.json:6"]],
			messages: [messages(), [expect.stringContaining(`Weakens "files/includes" for "**", "!vendor" ${CONSUMER_FIX}`)]],
		});
	},
);

for (const [what, preset, config, weakening] of [
	["files.includes", { files: { includes: ["**", "!**/generated"] } }, { files: { includes: ["**"] } }, '"files/includes" for "**", "!**/generated"'],
	["linter.includes", { linter: { includes: ["src/**"] } }, { linter: { includes: ["**"] } }, '"lint/includes" for "src/**"'],
] as const) {
	ruleStory.it(
		`suppressions/biome-overrides reports the preset's narrowed ${what} even when the consumer's list keeps every file`,
		[repositoryHas(...acmePreset(preset, []), consumer(config))],
		function* ({ check, messages }) {
			yield* check(biomeOverrides);

			expect(yield* messages()).toEqual([`Extends "@acme/lint/biome", which weakens ${weakening} ${PRESET_FIX}`]);
		},
	);
}

ruleStory.it(
	"suppressions/biome-overrides reports a consumer declaration that repeats one the preset ships",
	[
		repositoryHas(
			...acmePreset({ overrides: [{ includes: ["src/config.ts"], linter: { rules: { style: { noDefaultExport: "off" } } } }] }, [
				{ includes: ["src/config.ts"], reason: REASON, rule: "lint/style/noDefaultExport" },
			]),
			EXTENDS_ACME,
		),
	],
	function* ({ check, messages }) {
		yield* check(biomeOverrides, { declared: [{ includes: ["src/config.ts"], reason: REASON, rule: "lint/style/noDefaultExport" }] });

		expect(yield* messages()).toEqual([
			'Declares "lint/style/noDefaultExport" for "src/config.ts", which "@acme/lint/biome" already declares. Remove the declaration.',
		]);
	},
);

ruleStory.it(
	"suppressions/biome-overrides accepts a shipped declaration whose weakening the consumer turned back on",
	[
		repositoryHas(
			...acmePreset(off("suspicious", "noConsole"), [{ includes: ["**"], reason: REASON, rule: "lint/suspicious/noConsole" }]),
			consumer({ linter: { rules: { suspicious: "on" } } }),
		),
	],
	function* ({ check }) {
		expect(yield* check(biomeOverrides)).toEqual([]);
	},
);

ruleStory.it(
	"suppressions/biome-overrides scopes a preset and its declarations below the nested config that extends it",
	[
		repositoryHas(
			...acmePreset({ overrides: [CONFIG_FILES], ...off("suspicious", "noConsole") }, SHIPPED),
			consumer({ root: false }, "apps/web/biome.json"),
			{ content: "{}", path: "biome.json" },
		),
	],
	function* ({ check, locations, messages }) {
		yield* check(biomeOverrides);

		yield* outcomes({
			locations: [locations(), ["apps/web/biome.json:3"]],
			messages: [messages(), [`Extends "@acme/lint/biome", which weakens "lint/suspicious/noConsole" for "apps/web/**" ${PRESET_FIX}`]],
		});
	},
);
