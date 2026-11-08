import { expect } from "vitest";
import { CLI_EXIT } from "@shivaedev/quality/testing/adapters/cli.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { appTooling } from "#quality/test-support/appTooling.ts";

appTooling.it("typechecks React and browser code with the shared app preset", [], function* ({ typecheck }) {
	const result = yield* typecheck();
	expect(result.status, result.stdout + result.stderr).toBe(CLI_EXIT.passed);
});

appTooling.it("builds with the application's Vite plugins", [], function* ({ build, readBuild }) {
	const result = yield* build();
	expect(result.status, result.stdout + result.stderr).toBe(CLI_EXIT.passed);
	expect(yield* readBuild()).toContain("Application plugin");
});

appTooling.it("runs DOM stories while leaving slow stories out of the default run", [], function* ({ runTests }) {
	const result = yield* runTests();
	expect(result.status, result.stdout + result.stderr).toBe(CLI_EXIT.passed);
	expect(result.stdout).toContain("runs DOM stories");
});

appTooling.it("proxies framework routes with the original host and serves the application shell", [], function* ({ serve, request }) {
	yield* serve();
	yield* outcomes([
		["application shell", () => request("/"), expect.stringContaining("Application plugin")],
		["admin shell", () => request("/admin/jobs"), expect.stringContaining("Application plugin")],
	]);
	for (const path of ["/api/auth/session", "/rpc"]) {
		expect(yield* request(path)).toMatch(new RegExp(`^${path}\\|127\\.0\\.0\\.1:\\d+$`, "u"));
	}
});
