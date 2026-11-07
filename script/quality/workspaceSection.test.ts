import { expect } from "vitest";
import { repositoryHas, ruleFailure, ruleKit } from "#quality/test-support/ruleKit.ts";
import { workspaceSection } from "#quality/workspaceSection.ts";

for (const key of ["catalog", "catalogs", "overrides"]) {
	ruleKit.it(
		`rejects an inline ${key} section with a quoted heading`,
		[repositoryHas({ content: `'${key}': {}\n`, path: "pnpm-workspace.yaml" })],
		function* ({ check }) {
			const findings = yield* check(workspaceSection);

			expect(findings).toEqual([
				{
					file: "pnpm-workspace.yaml",
					line: 1,
					message: expect.stringContaining("holds an inline value"),
				},
			]);
		},
	);
	ruleKit.it(
		`accepts a block ${key} section with a heading comment`,
		[
			repositoryHas({
				content: `${key}: # centralized pins\n  effect: 4.0.4\n`,
				path: "pnpm-workspace.yaml",
			}),
		],
		function* ({ check }) {
			const findings = yield* check(workspaceSection);

			expect(findings).toEqual([]);
		},
	);
}

ruleKit.it("refuses a missing workspace catalog with the required-input failure", [], function* ({ check }) {
	const failure = yield* ruleFailure(check(workspaceSection));

	expect(failure).toBe("required input is missing: pnpm-workspace.yaml");
});
