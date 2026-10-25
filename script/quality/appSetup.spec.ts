import { expect } from "vitest";
import { appSetup, enclosedApp, unversionedApp, worktreeApp } from "#quality/test-support/appSetup.ts";
import { CLI_EXIT } from "#quality-fixtures/cli.ts";

appSetup.it("installs the active commit gate for an application", [], function* ({ setup, commit, hook }) {
	expect((yield* setup()).status).toBe(CLI_EXIT.passed);
	expect(hook()).toContain("Installed by @shivaedev/quality");
	const result = commit();
	expect(result.status).not.toBe(CLI_EXIT.passed);
	expect(result.stderr).toContain("run typecheck");
});

appSetup.it("installs the gate from a linked worktree", [worktreeApp], function* ({ setup, hook }) {
	expect((yield* setup()).status).toBe(CLI_EXIT.passed);
	expect(hook()).toContain("Installed by @shivaedev/quality");
});

for (const [name, trait] of [
	["unversioned", unversionedApp],
	["enclosed", enclosedApp],
] as const) {
	appSetup.it(`leaves Git hooks alone for an ${name} application`, [trait], function* ({ setup, hook }) {
		expect((yield* setup()).status).toBe(CLI_EXIT.passed);
		expect(hook()).toBeUndefined();
	});
}
