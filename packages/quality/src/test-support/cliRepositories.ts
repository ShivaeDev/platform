import { trees } from "./cli.ts";
import { qualityTree } from "./qualityTree.ts";
import { config, seedTree } from "./tree.ts";

export function localRuleRepository(): string {
	return qualityTree(trees.clean, [
		{
			content: [
				'import { defineConfig } from "@shivaedev/quality/config.ts";',
				'import { defineRule } from "@shivaedev/quality/rule.ts";',
				'const noLog = defineRule({ id: "local/no-console-log", description: "Log through the logger.",',
				'  check: ({ sources }) => sources.filter((file) => file.text.includes("console.log")).map((file) => ({ file: file.path, message: "logs to the console." })) });',
				'export default defineConfig({ local: [noLog], sources: ["src"] });',
			].join("\n"),
			path: "quality.config.ts",
		},
		{ content: 'console.log("ready");\n', path: "src/log.ts" },
	]);
}

export function commentedRepository(): string {
	return seedTree([config('{ sources: ["src"] }'), { content: "/** Adds. */\nexport const a = 1; // TODO\n// three\n", path: "src/a.ts" }]);
}

export function registeredDebtRepository(): string {
	return qualityTree(trees.dirty, [
		{
			content: JSON.stringify([
				{ file: "src/long.ts", reason: "Generated from the schema.", rule: "structure/max-lines" },
				{ file: "src/longer.ts", reason: "Generated from the schema.", rule: "structure/max-lines" },
			]),
			path: "quality/registry.json",
		},
	]);
}

export function downgradedRuleRepository(level: string): string {
	return seedTree([config(`{ rules: { "structure/max-lines": "${level}" } }`)]);
}

export function emptyBaselineRepository(): string {
	return qualityTree(trees.dirty, [{ content: "", path: "quality-baseline.jsonl" }]);
}

const invalidInputs = {
	brokenConfig: [{ content: "export default {", path: "quality.config.ts" }],
	invalidConfig: [config('{ rules: { "structure/max-line": "error" } }')],
	legacyBaseline: [config("{}"), { content: "{}\n", path: "quality/baseline.json" }],
	missingSource: [config('{ sources: ["srcc"] }')],
	throwingRule: [
		config(
			'{ local: [{ id: "local/boom", description: "Throws.", configure: async () => ({ _tag: "Ready", check: () => { throw new Error("boom"); } }) }] }',
		),
	],
	unreadableBaseline: [config("{}"), { content: "[]", path: "quality-baseline.jsonl" }],
};

export function invalidRepository(kind: keyof typeof invalidInputs): string {
	return seedTree(invalidInputs[kind]);
}
