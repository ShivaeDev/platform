import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { biomeFormatted, exceptionStory, repositoryHas } from "#test/exceptionStory.ts";
import { config } from "#test/tree.ts";

const REASON = "This parser documents and returns the external format unchanged.";
const PARSER = {
	content: "/** External format. */\nexport function parse(text: string): any {\n\treturn JSON.parse(text);\n}\n",
	path: "src/parse.ts",
};
const DOCUMENTED = {
	content: "/** External format. */\nexport function parse(text: string): unknown {\n\treturn JSON.parse(text);\n}\n",
	path: "src/parse.ts",
};
const DECLARATION = { files: [PARSER.path], reason: REASON, rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny"] };
const WEAKENING_BIOME = {
	content: JSON.stringify({
		extends: ["@shivaedev/quality/biome/preset.json"],
		overrides: [{ includes: [PARSER.path], linter: { rules: { suspicious: { noExplicitAny: "off" } } } }],
	}),
	path: "biome.json",
};

exceptionStory.it(
	"quality lint passes a file whose Quality and Biome findings one exception declares, counts the Quality one as registered and leaves biome.json unchanged",
	[repositoryHas(config(`{ exceptions: ${JSON.stringify([DECLARATION])}, sources: ["src"] }`), PARSER), biomeFormatted()],
	function* ({ outcome, reads, runs, stdout }) {
		const biome = yield* reads("biome.json");

		yield* runs("lint");

		yield* outcomes({
			"biome.json": [reads("biome.json"), biome],
			"exit": [outcome(), "passed"],
			"report": [stdout(), expect.stringContaining("1 registered violation not shown")],
		});
	},
	CLI_TIMEOUT,
);

exceptionStory.it(
	"quality lint refuses an exception without a reason and names the missing field",
	[repositoryHas(config(`{ exceptions: [{ files: ["src/parse.ts"], rules: ["comments/no-jsdoc"] }], sources: ["src"] }`), PARSER)],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint");

		yield* outcomes({
			"error": [stderr(), expect.stringContaining("exceptions.0.reason")],
			"exit": [outcome(), "invalid"],
		});
	},
	CLI_TIMEOUT,
);

exceptionStory.it(
	"quality lint still rejects a biome.json override that weakens a rule an exception declares for the same file",
	[repositoryHas(config(`{ exceptions: ${JSON.stringify([DECLARATION])}, sources: ["src"] }`), PARSER, WEAKENING_BIOME)],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"exit": [outcome(), "rejected"],
			"report": [stdout(), expect.stringContaining('Weakens "lint/suspicious/noExplicitAny"')],
		});
	},
	CLI_TIMEOUT,
);

for (const rule of DECLARATION.rules) {
	const suggested = { files: [PARSER.path], reason: "Explain why this exception is permanent.", rules: [rule] };
	exceptionStory.it(
		`quality lint rejects a ${rule} finding and suggests its exception for the config that --config selects`,
		[repositoryHas({ content: 'export default { sources: ["src"] };\n', path: "custom.config.ts" }, PARSER)],
		function* ({ outcome, runs, stdout }) {
			yield* runs("lint", "--config", "custom.config.ts");

			yield* outcomes({
				"exit": [outcome(), "rejected"],
				"report": [stdout(), expect.stringContaining(`add to exceptions in custom.config.ts: ${JSON.stringify(suggested)}`)],
			});
		},
		CLI_TIMEOUT,
	);
}

exceptionStory.it(
	"quality lint rejects a Biome exception that names a missing file",
	[
		repositoryHas(
			config(
				`{ exceptions: ${JSON.stringify([{ ...DECLARATION, files: ["src/missing.ts"], rules: ["biome/lint/suspicious/noExplicitAny"] }])}, sources: ["src"] }`,
			),
			PARSER,
		),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"exit": [outcome(), "rejected"],
			"report": [stdout(), expect.stringContaining("This Biome exception names a missing file")],
		});
	},
	CLI_TIMEOUT,
);

exceptionStory.it(
	"quality lint rejects a config exception that matches no violation as stale",
	[
		repositoryHas(
			config(`{ exceptions: ${JSON.stringify([{ ...DECLARATION, files: ["src/missing.ts"], rules: ["comments/no-jsdoc"] }])}, sources: ["src"] }`),
			PARSER,
		),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"exit": [outcome(), "rejected"],
			"report": [stdout(), expect.stringContaining("comments/no-jsdoc src/missing.ts matches no violation")],
		});
	},
	CLI_TIMEOUT,
);

exceptionStory.it(
	"quality lint passes a finding that a legacy quality/registry.json registers and counts it as registered",
	[
		repositoryHas(config('{ sources: ["src"] }'), DOCUMENTED, {
			content: JSON.stringify([{ file: DOCUMENTED.path, reason: REASON, rule: "comments/no-jsdoc" }]),
			path: "quality/registry.json",
		}),
		biomeFormatted(),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"exit": [outcome(), "passed"],
			"report": [stdout(), expect.stringContaining("1 registered violation not shown")],
		});
	},
	CLI_TIMEOUT,
);
