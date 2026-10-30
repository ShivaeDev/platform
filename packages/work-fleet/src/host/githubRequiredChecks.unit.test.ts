import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/test/it.ts";
import { ADOPTED_HEAD, checkRun, commitStatus, githubFixture, githubResult } from "#test/githubChecks.ts";

it.effect("keeps missing required contexts pending and ignores non-required pending checks", function* () {
	const fixture = githubFixture();
	fixture.required(["verify"]);
	fixture.reply(ADOPTED_HEAD, [[checkRun({ name: "optional" })]]);
	const missing = yield* fixture.checks(githubResult());
	expect(missing).toMatchObject({ passed: false, pending: true });
	expect(missing.evidence).toContain("verify: pending (required check has not reported)");
	expect(missing.repairPrompt).toBeUndefined();
	fixture.reply(ADOPTED_HEAD, [[checkRun({ name: "verify" }), checkRun({ conclusion: null, name: "optional", status: "queued" })]]);
	expect(yield* fixture.checks(githubResult())).toMatchObject({ passed: true, pending: false });
});

it.effect("repairs required legacy statuses only and combines branch protection with required contexts across rule pages", function* () {
	const fixture = githubFixture();
	fixture.branchProtection(["protected"]);
	fixture.responses.set(
		"repos/example/project/rules/branches/main",
		JSON.stringify([
			[{ parameters: { "required_status_checks": [{ context: "verify" }] }, type: "required_status_checks" }],
			[
				{ parameters: {}, type: "pull_request" },
				{ parameters: { "required_status_checks": [{ context: "legacy" }] }, type: "required_status_checks" },
			],
		]),
	);
	fixture.reply(
		ADOPTED_HEAD,
		[[checkRun({ name: "verify" }), checkRun({ conclusion: "failure", name: "optional" }), checkRun({ conclusion: "failure", name: "protected" })]],
		[[commitStatus({ state: "failure" })]],
	);
	const checks = yield* fixture.checks(githubResult());
	expect(checks).toMatchObject({ failedChecks: ["legacy", "protected"], passed: false, pending: false });
	expect(checks.repairPrompt).toContain("legacy: https://example.invalid/logs/legacy");
	expect(checks.repairPrompt).not.toContain("optional");
});

it.effect("reads required contexts for the configured base branch", function* () {
	const fixture = githubFixture("example/project", "release/next");
	fixture.required(["verify"]);
	fixture.reply(ADOPTED_HEAD, [[checkRun({ name: "verify" }), checkRun({ conclusion: "failure" })]]);
	expect(yield* fixture.checks(githubResult())).toMatchObject({ passed: true });
	expect(fixture.requests).toContain("repos/example/project/rules/branches/release%2Fnext");
});

it.effect("fails closed when required rules are unavailable or malformed", function* () {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	const endpoint = "repos/example/project/rules/branches/main";
	fixture.responses.delete(endpoint);
	expect(yield* fixture.checks(githubResult()).pipe(Effect.flip)).toMatchObject({
		message: "GitHub required status checks are unavailable or invalid",
	});
	for (const response of ["{}", JSON.stringify([[{ parameters: {}, type: "required_status_checks" }]])]) {
		fixture.responses.set(endpoint, response);
		expect(yield* fixture.checks(githubResult()).pipe(Effect.flip)).toMatchObject({
			message: "GitHub required status checks are unavailable or invalid",
		});
	}
});
