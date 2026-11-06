import { expect } from "@effect/vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";
import { packageRoot } from "#testing/adapters/tree.ts";

for (const [name, main, scripts, path] of [
	[
		"spawned scripts",
		'import { spawn } from "node:child_process"; spawn("node", ["scripts/task.ts"]);',
		{ start: "node src/main.ts" },
		"src/main.ts",
	],
	["quoted package-script paths", "", { start: 'node "scripts/task.ts"' }, undefined],
	["mock-only modules", 'import { vi } from "vitest"; vi.mock("../scripts/task.ts", () => ({}));', { test: "vitest run" }, "src/main.test.ts"],
	[
		"scripts spawned by tests",
		'import { spawn } from "node:child_process"; import { test } from "vitest"; test("runs", () => { spawn("node", ["scripts/task.ts"]); });',
		{ test: "vitest run" },
		"src/main.test.ts",
	],
] as const) {
	ruleStory.it(
		`code/unused treats ${name} as entries and still reports abandoned files`,
		[
			repositoryLinks("node_modules/vitest", `${packageRoot}/node_modules/vitest`),
			repositoryHas(
				{ content: "node_modules/\n", path: ".gitignore" },
				{
					content: JSON.stringify({
						devDependencies: path?.endsWith(".test.ts") === true ? { vitest: "*" } : {},
						name: "app",
						scripts,
						type: "module",
					}),
					path: "package.json",
				},
				...(path === undefined ? [] : [{ content: main, path }]),
				{ content: 'import { task } from "../src/task.ts"; task();', path: "scripts/task.ts" },
				{ content: "export const task = () => 1;", path: "src/task.ts" },
				{ content: "export const abandoned = 1;", path: "src/abandoned.ts" },
			),
		],
		function* ({ check }) {
			const findings = yield* check(unusedCode);

			expect(findings).toEqual([expect.objectContaining({ file: "src/abandoned.ts", subject: "files:src/abandoned.ts" })]);
		},
	);
}
