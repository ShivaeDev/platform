import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { exceptionStory, repositoryHas } from "#test/exceptionStory.ts";

const FILE = "src/parse.ts";
const REASON = "This parser preserves the external format.";
const EXISTING = { files: [FILE], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"] };
const LEGACY = { options: { declared: [{ includes: [FILE], reason: REASON, rule: "lint/suspicious/noExplicitAny" }] } };
const REGISTRY = { content: JSON.stringify([{ file: FILE, reason: REASON, rule: "comments/no-jsdoc" }]), path: "custom-registry.json" };
const OVERRIDING_BIOME = {
	content: JSON.stringify({ overrides: [{ includes: [FILE], linter: { rules: { suspicious: { noExplicitAny: "off" } } } }] }),
	path: "biome.json",
};

for (const quote of ['"', "`"]) {
	const computedConfig = {
		content: `export default {
			sources: ["src"],
			[${quote}exceptions${quote}]: ${JSON.stringify([EXISTING])},
			[${quote}registry${quote}]: "custom-registry.json",
			[${quote}rules${quote}]: { [${quote}suppressions/biome-overrides${quote}]: ${JSON.stringify(LEGACY)}, "comments/no-jsdoc": {} }
		};`,
		path: "quality.config.ts",
	};
	exceptionStory.it(
		`quality exceptions migrate reads keys computed from ${quote}-quoted literals, merges their exceptions into one, keeps the other rules and deletes the registry`,
		[repositoryHas(computedConfig, REGISTRY, OVERRIDING_BIOME)],
		function* ({ config, outcome, reads, runs }) {
			yield* runs("exceptions", "migrate");

			yield* outcomes({
				"config": [
					config(),
					{
						exceptions: [{ files: [FILE], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny", "comments/no-jsdoc"] }],
						rules: { "comments/no-jsdoc": {} },
						sources: ["src"],
					},
				],
				"exit": [outcome(), "passed"],
				"registry": [reads(REGISTRY.path), undefined],
			});
		},
	);
}

for (const [computed, properties] of [
	["the exceptions key", `[key]: ${JSON.stringify([EXISTING])}, rules: { "suppressions/biome-overrides": ${JSON.stringify(LEGACY)} }`],
	["a rule key", `exceptions: [], rules: { [rule]: ${JSON.stringify(LEGACY)} }`],
]) {
	exceptionStory.it(
		`quality exceptions migrate refuses ${computed} computed from a variable and changes no file`,
		[
			repositoryHas(
				{
					content: `const key = "exceptions"; const rule = "suppressions/biome-overrides";
						export default { ${properties}, registry: "custom-registry.json", sources: ["src"] };`,
					path: "quality.config.ts",
				},
				REGISTRY,
				OVERRIDING_BIOME,
			),
		],
		function* ({ files, outcome, runs, stderr }) {
			const before = yield* files();

			yield* runs("exceptions", "migrate");

			yield* outcomes({
				"error": [stderr(), expect.stringContaining("computed property")],
				"exit": [outcome(), "invalid"],
				"files": [files(), before],
			});
		},
	);
}
