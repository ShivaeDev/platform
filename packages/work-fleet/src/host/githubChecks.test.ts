import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { ADOPTED_HEAD, checkRun, commitStatus, githubFixture, githubResult, NEW_HEAD } from "#test/githubChecks.ts";

it.effect("reads green check runs and commit statuses from every page of the adopted SHA", function* () {
	const fixture = githubFixture();
	fixture.reply(
		ADOPTED_HEAD,
		[[checkRun()], [checkRun({ conclusion: "skipped", name: "optional" })]],
		[[commitStatus()], [commitStatus({ context: "deploy" })]],
	);
	const checks = yield* fixture.checks(githubResult());
	expect(checks).toMatchObject({ head: ADOPTED_HEAD, passed: true, pending: false });
	expect(checks.evidence).toHaveLength(4);
	expect(checks.repairPrompt).toBeUndefined();
	expect(fixture.requests).toEqual([
		`repos/example/project/commits/${ADOPTED_HEAD}/check-runs?per_page=100&filter=latest`,
		`repos/example/project/commits/${ADOPTED_HEAD}/status?per_page=100`,
	]);
});

it.effect("returns failing check names and log links, including legacy statuses on later pages", function* () {
	const fixture = githubFixture();
	fixture.reply(
		ADOPTED_HEAD,
		[[checkRun()], [checkRun({ conclusion: "failure", name: "build" })]],
		[[commitStatus()], [commitStatus({ context: "deploy", state: "error" })]],
	);
	const checks = yield* fixture.checks(githubResult());
	expect(checks).toMatchObject({ head: ADOPTED_HEAD, passed: false, pending: false });
	expect(checks.repairPrompt).toContain("build: https://example.invalid/logs/test");
	expect(checks.repairPrompt).toContain("deploy: https://example.invalid/logs/legacy");
	expect(checks.repairPrompt).toContain(ADOPTED_HEAD);
});

for (const status of ["queued", "in_progress", "waiting", "requested", "pending"]) {
	it.effect(`keeps ${status} check runs pending`, function* () {
		const fixture = githubFixture();
		fixture.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, status })]]);
		expect(yield* fixture.checks(githubResult())).toMatchObject({ head: ADOPTED_HEAD, passed: false, pending: true });
	});
}

it.effect("keeps absent checks and pending legacy statuses out of green validation", function* () {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[]]);
	expect(yield* fixture.checks(githubResult())).toMatchObject({ passed: false, pending: true });
	fixture.reply(ADOPTED_HEAD, [[checkRun()]], [[commitStatus({ state: "pending" })]]);
	expect(yield* fixture.checks(githubResult())).toMatchObject({ passed: false, pending: true });
});

it.effect("uses the adopted head after a newer push passes and rejects evidence for that newer SHA", function* () {
	const fixture = githubFixture();
	fixture.reply(NEW_HEAD, [[checkRun({ headSha: NEW_HEAD })]]);
	fixture.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure" })]]);
	expect(yield* fixture.checks(githubResult())).toMatchObject({ head: ADOPTED_HEAD, passed: false, pending: false });
	expect(fixture.requests.every((request) => request.includes(ADOPTED_HEAD))).toBe(true);
	fixture.reply(ADOPTED_HEAD, [[checkRun({ headSha: NEW_HEAD })]]);
	expect(yield* fixture.checks(githubResult()).pipe(Effect.flip)).toMatchObject({
		_tag: "ServiceUnavailable",
		message: expect.stringContaining("different commit SHA"),
	});
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	fixture.responses.set(`repos/example/project/commits/${ADOPTED_HEAD}/status?per_page=100`, JSON.stringify([{ sha: NEW_HEAD, statuses: [] }]));
	expect(yield* fixture.checks(githubResult()).pipe(Effect.flip)).toMatchObject({ _tag: "ServiceUnavailable" });
});

it.effect("fails closed when GitHub is unavailable or returns malformed pages", function* () {
	const fixture = githubFixture();
	expect(yield* fixture.checks(githubResult()).pipe(Effect.flip)).toMatchObject({ _tag: "ServiceUnavailable" });
	fixture.reply(ADOPTED_HEAD, [[checkRun()]]);
	fixture.responses.set(`repos/example/project/commits/${ADOPTED_HEAD}/status?per_page=100`, "{}");
	expect(yield* fixture.checks(githubResult()).pipe(Effect.flip)).toMatchObject({ _tag: "ServiceUnavailable" });
});

it.effect("decodes GitHub's wire field names and preserves its log URL", function* () {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[]]);
	fixture.responses.set(
		`repos/example/project/commits/${ADOPTED_HEAD}/check-runs?per_page=100&filter=latest`,
		JSON.stringify([
			{
				"check_runs": [
					{
						conclusion: "failure",
						"details_url": "https://example.invalid/actual-log",
						"head_sha": ADOPTED_HEAD,
						"html_url": "https://example.invalid/check",
						name: "wire-check",
						status: "completed",
					},
				],
			},
		]),
	);
	const checks = yield* fixture.checks(githubResult());
	expect(checks).toMatchObject({ head: ADOPTED_HEAD, passed: false, pending: false });
	expect(checks.repairPrompt).toContain("wire-check: https://example.invalid/actual-log");
});

for (const conclusion of ["cancelled", "timed_out", "action_required", "stale", "startup_failure"]) {
	it.effect(`sends ${conclusion} checks to repair even while other checks are pending`, function* () {
		const fixture = githubFixture();
		fixture.reply(ADOPTED_HEAD, [[checkRun({ conclusion }), checkRun({ conclusion: null, name: "waiting", status: "queued" })]]);
		const checks = yield* fixture.checks(githubResult());
		expect(checks).toMatchObject({ passed: false, pending: false });
		expect(checks.repairPrompt).toContain("test: https://example.invalid/logs/test");
	});
}

it.effect("accepts neutral and legacy-only green checks and retains links when log URLs are absent", function* () {
	const fixture = githubFixture();
	fixture.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "neutral" })]]);
	expect(yield* fixture.checks(githubResult())).toMatchObject({ passed: true });
	fixture.reply(ADOPTED_HEAD, [[]], [[commitStatus()]]);
	expect(yield* fixture.checks(githubResult())).toMatchObject({ passed: true });
	fixture.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", detailsUrl: null })]], [[commitStatus({ state: "failure", targetUrl: null })]]);
	const checks = yield* fixture.checks(githubResult());
	expect(checks.repairPrompt).toContain("https://example.invalid/check/test");
	expect(checks.repairPrompt).toContain(`/commit/${ADOPTED_HEAD}/checks`);
});

it.effect("rejects unsupported results and malformed PR identities before GitHub access", function* () {
	const fixture = githubFixture();
	for (const result of [
		{ evidence: ["no change"], head: ADOPTED_HEAD, kind: "no-change" as const },
		{ ...githubResult(), head: "main" },
		{ ...githubResult(), pr: "https://example.invalid/pr/7" },
	]) {
		expect(yield* fixture.checks(result).pipe(Effect.flip)).toMatchObject({ _tag: "ServiceUnavailable" });
	}
	expect(fixture.requests).toHaveLength(0);
});
