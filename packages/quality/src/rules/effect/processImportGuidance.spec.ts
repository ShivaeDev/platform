import { expect } from "@effect/vitest";
import { biome } from "#rules/biome.ts";
import { adapterImports } from "#rules/effect/adapterImports.ts";
import { qualityInstalled, repositoryHas, ruleStory } from "#test/ruleStory.ts";

const REPAIR = "an adapters/ module with explicit imports that exposes Effect values";
const PRESET = { content: '{"extends":["@shivaedev/quality/biome/preset.json"]}', path: "biome.json" };
const IGNORES = { content: "node_modules/\n", path: ".gitignore" };

for (const [name, rule, content, subject] of [
	["noProcessGlobal", biome, "export const cwd = process.cwd();", "lint/correctness/noProcessGlobal"],
	["adapter-imports", adapterImports, 'import process from "node:process"; export const cwd = process.cwd();', undefined],
] as const) {
	ruleStory.it(
		`${name} names the explicit-import Effect adapter and Config repairs`,
		[qualityInstalled(), repositoryHas(PRESET, IGNORES, { content, path: "src/cwd.ts" })],
		function* ({ check }) {
			const findings = yield* check(rule);

			expect(findings.filter((finding) => finding.subject === subject)).toEqual([
				expect.objectContaining({ message: expect.stringContaining(REPAIR) }),
			]);
			expect(findings.find((finding) => finding.subject === subject)?.message).toContain("Config");
		},
	);
}

for (const rule of [biome, adapterImports]) {
	ruleStory.it(
		`${rule.id} accepts an adapters/ module with explicit imports that exposes Effect values`,
		[
			qualityInstalled(),
			repositoryHas(PRESET, IGNORES, {
				content: 'import process from "node:process";\nimport { Effect } from "effect";\n\nexport const cwd = Effect.sync(() => process.cwd());\n',
				path: "src/adapters/cwd.ts",
			}),
		],
		function* ({ check }) {
			const findings = yield* check(rule);

			expect(
				findings.filter(({ subject }) => subject === undefined || subject === "lint/correctness/noProcessGlobal" || subject === "plugin"),
			).toEqual([]);
		},
	);
}
