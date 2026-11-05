import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { draftRule } from "#test/draftRule.ts";
import { qualityInstalled, repositoryHas, ruleStory } from "#test/ruleStory.ts";

const RULE_URL = import.meta.resolve("#test/draftRule.ts");
const CLOCK_RULE_URL = import.meta.resolve("#test/clockRule.ts");

ruleStory.it(
	"custom rules run on the story's clock and reject the gate until the author repairs the source",
	[
		qualityInstalled(),
		repositoryHas(
			{ content: "node_modules/\n", path: ".gitignore" },
			{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" },
			{
				content: `import { clockRule } from ${JSON.stringify(CLOCK_RULE_URL)};\nimport { draftRule } from ${JSON.stringify(RULE_URL)};\n\nexport default {\n\tlocal: [draftRule, clockRule],\n\trules: { "local/no-draft": { options: { word: "draft" } } },\n\tsources: ["src"],\n};\n`,
				path: "quality.config.ts",
			},
			{ content: 'export function title(): string {\n\treturn "draft";\n}\n', path: "src/title.ts" },
		),
	],
	function* ({ check, findings, gate, gateOutcome, gateReport, writes }) {
		yield* check(draftRule, { word: "draft" }, "src");

		expect(yield* findings()).toEqual([{ file: "title.ts", line: 2, message: "Replace draft before merging." }]);

		yield* gate();

		yield* outcomes([
			["gate outcome", () => gateOutcome(), "rejected"],
			["gate report", () => gateReport(), expect.stringContaining("Replace draft before merging.")],
			["rule time", () => gateReport(), expect.stringContaining("Rule checked at 0")],
		]);

		yield* writes({ content: 'export function title(): string {\n\treturn "ready";\n}\n', path: "src/title.ts" });
		yield* gate();

		expect(yield* gateOutcome()).toBe("passed");
	},
);

ruleStory.it(
	"the gate exposes invalid custom-rule options",
	[
		qualityInstalled(),
		repositoryHas({
			content: `import { draftRule } from ${JSON.stringify(RULE_URL)};\nexport default { local: [draftRule], rules: { "local/no-draft": { options: { word: 1 } } }, sources: ["src"] };\n`,
			path: "quality.config.ts",
		}),
	],
	function* ({ gate, gateOutcome, gateReport }) {
		yield* gate();

		yield* outcomes([
			["gate outcome", () => gateOutcome(), "invalid"],
			["option issue", () => gateReport(), expect.stringContaining("rules.local/no-draft.options: word:")],
		]);
	},
);
