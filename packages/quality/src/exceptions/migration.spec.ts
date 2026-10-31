import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { exceptionStory, exceptionsMigrated, repositoryHas } from "#test/exceptionStory.ts";
import { config } from "#test/tree.ts";

const FILE = "src/parse.ts";
const REASON = "This parser preserves the external format.";
const PARSER = {
	content: "/** External format. */\nexport function parse(text: string): any {\n\treturn JSON.parse(text);\n}\n",
	path: FILE,
};
const LEGACY_RULES = {
	"suppressions/biome-overrides": { options: { declared: [{ includes: [FILE], reason: REASON, rule: "lint/suspicious/noExplicitAny" }] } },
};
const REGISTRY_ENTRY = { file: FILE, reason: REASON, rule: "comments/no-jsdoc" };
const REGISTRY = { content: JSON.stringify([REGISTRY_ENTRY]), path: "quality/registry.json" };
const OVERRIDING_BIOME = {
	content: JSON.stringify({
		extends: ["@shivaedev/quality/biome/preset.json"],
		overrides: [{ includes: [FILE], linter: { rules: { suspicious: { noExplicitAny: "off" } } } }],
	}),
	path: "biome.json",
};
const MERGED = { files: [FILE], reason: REASON, rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny"] };

exceptionStory.it(
	"quality exceptions migrate merges a registry entry and a Biome declaration for one file into one exception and deletes the registry and the duplicated biome.json override",
	[repositoryHas(config(`{ rules: ${JSON.stringify(LEGACY_RULES)}, sources: ["src"] }`), PARSER, OVERRIDING_BIOME, REGISTRY)],
	function* ({ config: exported, outcome, reads, runs }) {
		yield* runs("exceptions", "migrate");

		yield* outcomes({
			"biome.json": [reads("biome.json"), expect.not.stringContaining("overrides")],
			"config": [exported(), { exceptions: [MERGED], sources: ["src"] }],
			"exit": [outcome(), "passed"],
			"registry": [reads(REGISTRY.path), undefined],
		});
	},
	CLI_TIMEOUT,
);

exceptionStory.it(
	"quality exceptions migrate --from a legacy registry creates quality.config.ts with its exception and subject and deletes that registry",
	[repositoryHas(PARSER, { content: JSON.stringify([{ ...REGISTRY_ENTRY, subject: "external-format" }]), path: "old-exceptions.json" })],
	function* ({ config: exported, outcome, reads, runs }) {
		expect(yield* reads("quality.config.ts")).toBeUndefined();

		yield* runs("exceptions", "migrate", "--from", "old-exceptions.json");

		yield* outcomes({
			"config": [exported(), { exceptions: [{ files: [FILE], reason: REASON, rules: ["comments/no-jsdoc"], subject: "external-format" }] }],
			"exit": [outcome(), "passed"],
			"registry": [reads("old-exceptions.json"), undefined],
		});
	},
	CLI_TIMEOUT,
);

exceptionStory.it(
	"quality exceptions migrate run again on a config it migrated passes and leaves the config unchanged",
	[repositoryHas(config(`{ rules: ${JSON.stringify(LEGACY_RULES)}, sources: ["src"] }`), PARSER, OVERRIDING_BIOME, REGISTRY), exceptionsMigrated()],
	function* ({ outcome, reads, runs }) {
		const migrated = yield* reads("quality.config.ts");

		yield* runs("exceptions", "migrate");

		yield* outcomes({
			"config": [reads("quality.config.ts"), migrated],
			"exit": [outcome(), "passed"],
		});
	},
	CLI_TIMEOUT,
);

for (const [shape, property] of [
	["shorthand property", "rules"],
	["getter", "get rules() { return rules; }"],
]) {
	exceptionStory.it(
		`quality exceptions migrate refuses legacy rules declared through a ${shape}, asks to inline them and changes no file`,
		[
			repositoryHas(
				{ content: `const rules = ${JSON.stringify(LEGACY_RULES)}; export default { ${property}, sources: ["src"] };\n`, path: "quality.config.ts" },
				REGISTRY,
				OVERRIDING_BIOME,
			),
		],
		function* ({ files, outcome, runs, stderr }) {
			const before = yield* files();

			yield* runs("exceptions", "migrate");

			yield* outcomes({
				"error": [stderr(), expect.stringContaining("Inline the rules object")],
				"exit": [outcome(), "invalid"],
				"files": [files(), before],
			});
		},
		CLI_TIMEOUT,
	);
}

exceptionStory.it(
	"quality exceptions migrate --from a missing file refuses, names that file and changes no file",
	[
		repositoryHas(
			config(`{ registry: "custom-registry.json", rules: ${JSON.stringify(LEGACY_RULES)}, sources: ["src"] }`),
			{ ...REGISTRY, path: "custom-registry.json" },
			OVERRIDING_BIOME,
		),
	],
	function* ({ files, outcome, runs, stderr }) {
		const before = yield* files();

		yield* runs("exceptions", "migrate", "--from", "typo.json");

		yield* outcomes({
			"error": [stderr(), expect.stringContaining("typo.json does not exist")],
			"exit": [outcome(), "invalid"],
			"files": [files(), before],
		});
	},
	CLI_TIMEOUT,
);

exceptionStory.it(
	"quality exceptions migrate refuses a config that does not export an object literal and changes no file",
	[repositoryHas({ content: 'const policy = { sources: ["src"] }; export default policy;', path: "custom.config.ts" }, PARSER, REGISTRY)],
	function* ({ files, outcome, runs, stderr }) {
		const before = yield* files();

		yield* runs("exceptions", "migrate", "--config", "custom.config.ts");

		yield* outcomes({
			"error": [stderr(), expect.stringContaining("Cannot migrate")],
			"exit": [outcome(), "invalid"],
			"files": [files(), before],
		});
	},
	CLI_TIMEOUT,
);
