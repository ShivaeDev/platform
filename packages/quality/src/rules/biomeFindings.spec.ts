import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";

const UNTYPED_PARSER = { content: "export function parse(text: string): any {\n\treturn JSON.parse(text);\n}\n", path: "src/parse.ts" };

const TYPED_SOURCE = { content: "export function value(): number {\n\treturn 1;\n}\n", path: "src/value.ts" };

const SECOND_UNTYPED_FUNCTION = {
	content: `${UNTYPED_PARSER.content}\nexport function revive(text: string): any {\n\treturn JSON.parse(text);\n}\n`,
	path: "src/parse.ts",
};

const WARNING_OVERRIDE = {
	content:
		'{ "extends": ["@shivaedev/quality/biome/preset.json"], "overrides": [{ "includes": ["src/parse.ts"], "linter": { "rules": { "suspicious": { "noExplicitAny": "warn" } } } }] }\n',
	path: "biome.json",
};

const DECLARED_WARNING = {
	content:
		'export default {\n\trules: {\n\t\t"suppressions/biome-overrides": { options: { declared: [{ includes: ["src/parse.ts"], reason: "The legacy parser returns untyped JSON.", rule: "lint/suspicious/noExplicitAny" }] } },\n\t},\n};\n',
	path: "quality.config.ts",
};

repositoryStory.it(
	"quality lint rejects a Biome lint finding as biome/<category> at its line with Biome's message",
	[qualityInstalled(), repositoryHas(UNTYPED_PARSER)],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			exit: [outcome(), "rejected"],
			report: [
				stdout(),
				expect.stringContaining("error biome/lint/suspicious/noExplicitAny (1)\n  src/parse.ts:1  Unexpected any. Specify a different type."),
			],
		});
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint rejects an unformatted file as biome/format and asks for quality fix",
	[qualityInstalled(), repositoryHas({ content: "export const b = 1\n", path: "src/b.ts" })],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			exit: [outcome(), "rejected"],
			report: [stdout(), expect.stringContaining("error biome/format (1)\n  src/b.ts  Is not formatted. Run `quality fix`.")],
		});
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality baseline write records a Biome finding under its rule and file",
	[qualityInstalled(), repositoryHas(UNTYPED_PARSER)],
	function* ({ reads, runs, stdout }) {
		yield* runs("baseline", "write");

		yield* outcomes({
			baseline: [reads("quality-baseline.jsonl"), '{"path":"src/parse.ts","rule":"biome/lint/suspicious/noExplicitAny","count":1}\n'],
			report: [stdout(), "quality: recorded 1 entry in quality-baseline.jsonl.\n"],
		});
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint passes a baselined Biome finding and rejects its file once a second finding grows it past the baseline",
	[qualityInstalled(), repositoryHas(UNTYPED_PARSER)],
	function* ({ outcome, runs, stdout, writes }) {
		yield* runs("baseline", "write");
		expect((yield* runs("lint")).outcome).toBe("passed");

		yield* writes(SECOND_UNTYPED_FUNCTION);
		yield* runs("lint");

		yield* outcomes({
			exit: [outcome(), "rejected"],
			report: [stdout(), expect.stringContaining("src/parse.ts is over its baseline: 2 against 1 baselined.")],
		});
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality baseline write --rule biome records the findings of every Biome rule",
	[qualityInstalled(), repositoryHas(UNTYPED_PARSER)],
	function* ({ reads, runs }) {
		yield* runs("baseline", "write", "--rule", "biome");

		expect(yield* reads("quality-baseline.jsonl")).toBe('{"path":"src/parse.ts","rule":"biome/lint/suspicious/noExplicitAny","count":1}\n');
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint asks for a root Biome config that extends the shared preset",
	[qualityInstalled(), repositoryHas({ content: '{ "extends": [] }\n', path: "biome.json" }, TYPED_SOURCE)],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			exit: [outcome(), "rejected"],
			report: [
				stdout(),
				expect.stringContaining('error biome/preset (1)\n  biome.json  Extend "@shivaedev/quality/biome/preset.json" from the root Biome config.'),
			],
		});
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint passes a Biome finding that a declared override turns down to a warning",
	[qualityInstalled(), repositoryHas(WARNING_OVERRIDE, DECLARED_WARNING, UNTYPED_PARSER), biomeFormatted()],
	function* ({ outcome, runs }) {
		yield* runs("lint");

		expect(yield* outcome()).toBe("passed");
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint stops as invalid with Biome's own message when Biome cannot read its config",
	[
		qualityInstalled(),
		repositoryHas(
			{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"], "linter": { "unknownKey": true } }\n', path: "biome.json" },
			TYPED_SOURCE,
		),
	],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint");

		yield* outcomes({
			"Biome's message": [stderr(), expect.stringContaining("Found an unknown key `unknownKey`.")],
			"exit": [outcome(), "invalid"],
			"failing rule": [stderr(), expect.stringContaining("rule biome failed: biome check")],
		});
	},
	CLI_TIMEOUT,
);
