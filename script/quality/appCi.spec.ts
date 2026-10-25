import { expect } from "vitest";
import { appCi, failingBuild } from "#quality/test-support/appCi.ts";
import { CLI_EXIT } from "#quality-fixtures/cli.ts";

appCi.it("checks peers then runs the application's lint, types, build and tests", [], function* ({ run, completed }) {
	const result = yield* run();
	expect(result.status, result.stdout + result.stderr).toBe(CLI_EXIT.passed);
	expect(result.stdout).toContain("pnpm peers check");
	expect(completed()).toBe("lint\ntypecheck\nbuild\ntest\n");
});

appCi.it("stops the gate at the failed application command", [failingBuild], function* ({ run, completed }) {
	const result = yield* run();
	expect(result.status).toBe(CLI_EXIT.rejected);
	expect(result.stderr).toContain("pnpm run build failed");
	expect(completed()).toBe("lint\ntypecheck\nbuild\n");
});
