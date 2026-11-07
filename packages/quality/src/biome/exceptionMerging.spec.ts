import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { exceptionConfigStory, qualityInstalled, rootConfig } from "#test/exceptionConfigStory.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";

const REASON = "The external format requires it.";

const UNTYPED_PARSER: readonly ExceptionDeclaration[] = [{ files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"] }];

const EXCLUDED_DIRECTORIES: readonly ExceptionDeclaration[] = [
	{ files: ["**", "!**/generated"], reason: REASON, rules: ["biome/files/includes"] },
	{ files: ["**", "!**/fixtures"], reason: REASON, rules: ["biome/files/includes"] },
];

const OWN_FOLDERS = ["!.worktrees"];

const REPOSITORY_CONFIG = {
	extends: ["@shivaedev/quality/biome/preset.json"],
	formatter: { lineWidth: 150 },
	overrides: [{ formatter: { lineWidth: 100 }, includes: ["src/other.ts"] }],
	plugins: ["./imports.grit"],
};

const REPOSITORY_TEXT = `// Repository config\n${JSON.stringify(REPOSITORY_CONFIG)}\n`;

for (const [label, includes, kept] of [
	["no files.includes", undefined, ["**"]],
	['files.includes ["**", "!**/vendor"]', ["**", "!**/vendor"], ["**", "!**/vendor"]],
	['files.includes ["src/**", "!src/vendor"]', ["src/**", "!src/vendor"], ["src/**", "!src/vendor"]],
] as const) {
	exceptionConfigStory.it(
		`the generated Biome config for a biome.json with ${label} adds both declared directory exclusions and quality's own folders without re-including **`,
		[rootConfig("biome.json", JSON.stringify({ files: { includes } }))],
		function* ({ generatedConfig, runsCommand }) {
			yield* runsCommand(EXCLUDED_DIRECTORIES);

			yield* assertThat(yield* generatedConfig(), (actual, expect) =>
				actual.toEqual(expect.objectContaining({ files: { includes: [...kept, "!**/generated", "!**/fixtures", ...OWN_FOLDERS] } })),
			);
		},
	);
}

for (const [label, config] of [
	["files is not an object", { files: false }],
	["files.includes is not a list", { files: { includes: "src/**" } }],
	["overrides is not a list", { overrides: {} }],
] as const) {
	exceptionConfigStory.it(
		`quality refuses to merge exceptions into a biome.json whose ${label}, without running the command or leaving a generated config`,
		[rootConfig("biome.json", JSON.stringify(config))],
		function* ({ files, outcome, runsCommand }) {
			yield* runsCommand(UNTYPED_PARSER);

			yield* withMatchers((expect) =>
				outcomes([
					["files", () => files(), ["biome.json"]],
					["outcome", () => outcome(), expect.stringContaining("failed: Cannot merge exceptions into invalid biome.json")],
				]),
			);
		},
	);
}

exceptionConfigStory.it(
	"the root biome.jsonc keeps its text while the command runs on the generated config",
	[rootConfig("biome.jsonc", REPOSITORY_TEXT), qualityInstalled()],
	function* ({ rootConfigDuringCommand, runsCommand }) {
		yield* runsCommand(UNTYPED_PARSER);

		yield* assertThat(yield* rootConfigDuringCommand(), (actual) => actual.toBe(REPOSITORY_TEXT));
	},
);
