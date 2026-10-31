import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";

const SUPPRESSED = {
	content: "declare const raw: string;\n// @ts-expect-error The types reject it.\nexport const a: number = raw as unknown as number;\n",
	path: "src/a.ts",
};

const SUPPRESSED_TWICE = { content: `${SUPPRESSED.content}// @ts-ignore\n`, path: "src/a.ts" };

const CLEAN = { content: "export function a(): number {\n\treturn 1;\n}\n", path: "src/a.ts" };

const EMPTY_PATTERN_OFF = {
	content:
		'{\n\t"extends": ["@shivaedev/quality/biome/preset.json"],\n\t"overrides": [{ "includes": ["src/vitest.ts"], "linter": { "rules": { "correctness": { "noEmptyPattern": "off" } } } }]\n}\n',
	path: "biome.json",
};

const EXPLICIT_ANY_OFF = {
	content:
		'{\n\t"extends": ["@shivaedev/quality/biome/preset.json"],\n\t"overrides": [{ "includes": ["src/vitest.ts"], "linter": { "rules": { "suspicious": { "noExplicitAny": "off" } } } }]\n}\n',
	path: "biome.json",
};

const EMPTY_PATTERN_DECLARED = {
	content:
		'export default {\n\trules: {\n\t\t"suppressions/biome-overrides": {\n\t\t\toptions: {\n\t\t\t\tdeclared: [\n\t\t\t\t\t{\n\t\t\t\t\t\tincludes: ["src/vitest.ts"],\n\t\t\t\t\t\treason: "Vitest reads the fixture\'s first parameter and needs an object pattern.",\n\t\t\t\t\t\trule: "lint/correctness/noEmptyPattern",\n\t\t\t\t\t},\n\t\t\t\t],\n\t\t\t},\n\t\t},\n\t},\n};\n',
	path: "quality.config.ts",
};

const NO_INLINE_REGISTERED = {
	content: JSON.stringify([{ file: "src/a.ts", reason: "Legacy code.", rule: "suppressions/no-inline" }]),
	path: "quality/registry.json",
};

repositoryStory.it(
	"quality lint with the default rules rejects an inline suppression, a double cast and an undeclared Biome override",
	[qualityInstalled(), repositoryHas(EMPTY_PATTERN_OFF, SUPPRESSED), biomeFormatted()],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"double cast": [stdout(), expect.stringContaining('  src/a.ts:3  Casts through "unknown" to reach a type the value does not have.')],
			"exit": [outcome(), "rejected"],
			"inline suppression": [stdout(), expect.stringContaining('  src/a.ts:2  Suppresses a check: "@ts-expect-error".')],
			"undeclared override": [
				stdout(),
				expect.stringContaining('  biome.json:3  Weakens "lint/correctness/noEmptyPattern" for "src/vitest.ts" without a declaration.'),
			],
		});
	},
);

repositoryStory.it(
	"quality lint accepts a declared Biome override and rejects biome.json once it turns another rule off instead, reporting the declaration as stale",
	[qualityInstalled(), repositoryHas(EMPTY_PATTERN_DECLARED, EMPTY_PATTERN_OFF, CLEAN), biomeFormatted()],
	function* ({ outcome, runs, stdout, writes }) {
		expect((yield* runs("lint")).outcome).toBe("passed");

		yield* writes(EXPLICIT_ANY_OFF);
		yield* runs("lint");

		yield* outcomes({
			"exit": [outcome(), "rejected"],
			"stale declaration": [
				stdout(),
				expect.stringContaining('Declares "lint/correctness/noEmptyPattern" for "src/vitest.ts", which no Biome config weakens.'),
			],
			"undeclared override": [
				stdout(),
				expect.stringContaining('Weakens "lint/suspicious/noExplicitAny" for "src/vitest.ts" without a declaration.'),
			],
		});
	},
);

repositoryStory.it(
	"quality lint refuses a registry entry for suppressions/no-inline and still reports the suppression it names",
	[qualityInstalled(), repositoryHas(SUPPRESSED, NO_INLINE_REGISTERED), biomeFormatted()],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"exit": [outcome(), "rejected"],
			"refused entry": [stdout(), expect.stringContaining("suppressions/no-inline src/a.ts names a rule that takes no exceptions.")],
			"suppression": [stdout(), expect.stringContaining('  src/a.ts:2  Suppresses a check: "@ts-expect-error".')],
		});
	},
);

repositoryStory.it(
	"quality lint passes the baselined suppressions of a file and rejects it once another suppression grows it past its baseline",
	[qualityInstalled(), repositoryHas(SUPPRESSED), biomeFormatted()],
	function* ({ outcome, runs, stdout, writes }) {
		yield* runs("baseline", "write");
		expect((yield* runs("lint")).outcome).toBe("passed");

		yield* writes(SUPPRESSED_TWICE);
		yield* runs("lint");

		yield* outcomes({
			exit: [outcome(), "rejected"],
			report: [stdout(), expect.stringContaining("src/a.ts is over its baseline: 2 against 1 baselined.")],
		});
	},
);
