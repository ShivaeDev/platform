import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { exceptionConfigStory, qualityInstalled, rootConfig } from "#test/exceptionConfigStory.ts";

const REASON = "The external format requires it.";

const UNTYPED_PARSER: readonly ExceptionDeclaration[] = [{ files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"] }];

const EXCLUDED_DIRECTORIES: readonly ExceptionDeclaration[] = [
	{ files: ["**", "!**/generated"], reason: REASON, rules: ["biome/files/includes"] },
	{ files: ["**", "!**/fixtures"], reason: REASON, rules: ["biome/files/includes"] },
];

const OWN_FOLDERS = ["!.worktrees", "!.quality-biome-*"];

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

			expect(yield* generatedConfig()).toEqual(
				expect.objectContaining({ files: { includes: [...kept, "!**/generated", "!**/fixtures", ...OWN_FOLDERS] } }),
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

			yield* outcomes([
				["files", () => files(), ["biome.json"]],
				["outcome", () => outcome(), expect.stringContaining("failed: Cannot merge exceptions into invalid biome.json")],
			]);
		},
	);
}

exceptionConfigStory.it(
	"the command receives a generated config inside the repository that keeps the root config's settings and overrides, relocates its extends and resolves its plugins from the root",
	[rootConfig("biome.jsonc", REPOSITORY_TEXT), qualityInstalled()],
	function* ({ configPath, generatedConfig, runsCommand }) {
		yield* runsCommand(UNTYPED_PARSER);

		yield* outcomes([
			[
				"config",
				() => generatedConfig(),
				expect.objectContaining({
					extends: [expect.stringMatching(/^<root>\/\.quality-biome-/u)],
					formatter: { lineWidth: 150 },
					overrides: [
						{ formatter: { lineWidth: 100 }, includes: ["src/other.ts"] },
						{ includes: ["src/parse.ts"], linter: { rules: { suspicious: { noExplicitAny: "off" } } } },
					],
					plugins: ["<root>/imports.grit"],
				}),
			],
			["config path", () => configPath(), expect.stringMatching(/^<root>\/\.quality-biome-/u)],
		]);
	},
);

exceptionConfigStory.it(
	"the root biome.jsonc keeps its text while the command runs on the generated config",
	[rootConfig("biome.jsonc", REPOSITORY_TEXT), qualityInstalled()],
	function* ({ rootConfigDuringCommand, runsCommand }) {
		yield* runsCommand(UNTYPED_PARSER);

		expect(yield* rootConfigDuringCommand()).toBe(REPOSITORY_TEXT);
	},
);

exceptionConfigStory.it(
	"quality removes the generated config once the command has run",
	[rootConfig("biome.jsonc", REPOSITORY_TEXT), qualityInstalled()],
	function* ({ files, filesDuringCommand, outcome, runsCommand }) {
		yield* runsCommand(UNTYPED_PARSER);

		yield* outcomes([
			["files after the command", () => files(), ["biome.jsonc", "node_modules"]],
			["files during the command", () => filesDuringCommand(), expect.arrayContaining([expect.stringMatching(/^\.quality-biome-/u)])],
			["outcome", () => outcome(), "ran"],
		]);
	},
);
