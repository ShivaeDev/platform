import { expect } from "@effect/vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";
import { packageRoot } from "#testing/adapters/tree.ts";

for (const [name, main, scripts] of [
	["spawned scripts", 'import { spawn } from "node:child_process"; spawn("node", ["scripts/task.ts"]);', { start: "node src/main.ts" }],
	["quoted package-script paths", "export {};", { start: 'node "scripts/task.ts"' }],
	["mock-only modules", 'import { vi } from "vitest"; vi.mock("../scripts/task.ts", () => ({}));', { start: "node src/main.ts" }],
] as const) {
	ruleStory.it(
		`code/unused treats ${name} as entries and still reports abandoned files`,
		[
			repositoryLinks("node_modules/vitest", `${packageRoot}/node_modules/vitest`),
			repositoryHas(
				{ content: "node_modules/\n", path: ".gitignore" },
				{
					content: JSON.stringify({ devDependencies: name === "mock-only modules" ? { vitest: "*" } : {}, name: "app", scripts, type: "module" }),
					path: "package.json",
				},
				...(name === "quoted package-script paths"
					? []
					: [{ content: main, path: name === "mock-only modules" ? "src/main.test.ts" : "src/main.ts" }]),
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
