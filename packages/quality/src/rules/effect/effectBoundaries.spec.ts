import { expect } from "vitest";
import { effectPolicyStory, policyFiles } from "#effect-policy-story";
import { PROMISE_BRIDGE } from "#test/effectPolicyFiles.ts";

effectPolicyStory.it(
	"source, specs and tooling report every non-Effect construct",
	[
		policyFiles(
			{ content: PROMISE_BRIDGE, path: "src/bridge.ts" },
			{ content: PROMISE_BRIDGE, path: "src/bridge.spec.ts" },
			{ content: PROMISE_BRIDGE, path: "tooling/bridge.ts" },
			{
				content: "export async function iteration(source: AsyncIterable<unknown>) { for await (const value of source) String(value); }",
				path: "src/iteration.ts",
			},
			{
				content: "export async function disposal(resource: AsyncDisposable) { await using current = resource; return current; }",
				path: "src/disposal.ts",
			},
			{ content: "export const arrows = async () => 1; export class Methods { async run() { return 1; } }", path: "src/arrows.ts" },
		),
	],
	function* ({ lint }) {
		const result = yield* lint();
		const exitCode = result.status;
		expect(exitCode).toBe(1);
		expect(result.stdout).toContain("effect/boundary");
		expect(result.stdout).toMatch(/src\/iteration\.ts:\d+ {2}Uses await\./u);
		expect(result.stdout).toMatch(/src\/disposal\.ts:\d+ {2}Uses await\./u);
		for (const path of ["src/bridge.ts", "src/bridge.spec.ts", "tooling/bridge.ts"]) {
			expect(result.stdout).toContain(`${path}:1  Uses async function.`);
		}
		for (const construct of [
			"async function",
			"async arrow",
			"async method",
			"await",
			"new Promise(...)",
			".then(...)",
			"try statement",
			"throw statement",
		]) {
			expect(result.stdout).toContain(`Uses ${construct}.`);
		}
	},
);

effectPolicyStory.it(
	"adapter and test-support folders work at every depth with only the shared preset",
	[
		policyFiles(
			{ content: PROMISE_BRIDGE, path: "src/sentinel.ts" },
			...["src/adapters/bridge.ts", "src/nested/adapters/bridge.ts", "src/test-support/bridge.ts", "tooling/nested/test-support/bridge.ts"].map(
				(path) => ({ content: PROMISE_BRIDGE, path }),
			),
		),
	],
	function* ({ lint, writes }) {
		expect((yield* lint()).stdout).toContain("Uses async function.");
		yield* writes({ content: "export function sentinel() { return 1; }", path: "src/sentinel.ts" });
		const result = yield* lint();
		expect(result.stdout).not.toContain("effect/boundary");
		yield* writes({
			content: 'export function ambient() { console.log(Date.now(), Math.random(), process.env["MODE"]); }',
			path: "src/adapters/ambient.ts",
		});
		const ambient = yield* lint();
		for (const message of [
			"Ambient time is banned",
			"Ambient randomness is banned. Use Effect's Crypto service for secure values and Random for non-secure values.",
			"console.* is banned",
			"process.env is banned",
		]) {
			expect(ambient.stdout).toContain(message);
		}
	},
);

effectPolicyStory.it(
	"config exceptions and inline suppressions cannot excuse a boundary finding, but the baseline records it",
	[
		policyFiles(
			{ content: "// biome-ignore lint/plugin: bridge\nexport const BRIDGE = async () => 1;", path: "src/bridge.ts" },
			{
				content:
					'export default { sources: ["src", "tooling"], exceptions: [{ files: ["src/bridge.ts"], rules: ["effect/boundary"], reason: "An old bridge." }] };',
				path: "quality.config.ts",
			},
		),
	],
	function* ({ lint, writes, baseline }) {
		const refused = yield* lint();
		expect(refused.stdout).toContain("effect/boundary src/bridge.ts names a rule that takes no exceptions");
		expect(refused.stdout).toContain("Uses async arrow.");
		expect(refused.stdout).toContain("Suppresses a check");
		yield* writes({ content: 'export default { sources: ["src", "tooling"] };', path: "quality.config.ts" });
		expect((yield* baseline("effect/boundary")).status).toBe(0);
		expect((yield* lint()).stdout).not.toContain("Uses async arrow.");
	},
);
