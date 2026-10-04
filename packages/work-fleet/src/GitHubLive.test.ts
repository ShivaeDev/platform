import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { ChangeHost } from "#ports.ts";
import { checkoutResponses, effectApp, pullRequest, revision, scriptedGitHub, work } from "#test/support/githubFixtures.ts";

effectApp("reads actual gh rollup shapes and requires unknown checks to remain pending", function* () {
	const fixture = scriptedGitHub([
		JSON.stringify({
			...pullRequest,
			statusCheckRollup: [
				...pullRequest.statusCheckRollup,
				{ __typename: "StatusContext", context: "deploy", state: "PENDING", targetUrl: "https://example.com/deploy" },
				{ __typename: "CheckRun", conclusion: "NEUTRAL", name: "lint", status: "COMPLETED" },
			],
		}),
	]);
	const observed = yield* Effect.flatMap(ChangeHost, (host) => host.observe({ ...work, requiredChecks: ["missing"] }, 12)).pipe(
		Effect.provide(fixture.layer),
	);
	expect(observed.checks).toEqual([
		{ name: "test", status: "passed" },
		{ name: "deploy", status: "pending" },
		{ name: "lint", status: "pending" },
		{ name: "missing", status: "pending" },
	]);
	expect(fixture.calls[0]?.args).toContain("github.com/example/project");
});
effectApp("rechecks policy and passes the exact head to ordinary merge", function* () {
	const fixture = scriptedGitHub([JSON.stringify(pullRequest), ...checkoutResponses(), "", ""]);
	yield* Effect.flatMap(ChangeHost, (host) => host.merge(work, 12, revision)).pipe(Effect.provide(fixture.layer));
	expect(fixture.calls.at(-1)).toEqual({
		args: ["pr", "merge", "12", "--repo", "github.com/example/project", "--merge", "--match-head-commit", revision],
		command: "gh",
	});
});
for (const override of [
	{ mergeStateStatus: "BLOCKED" },
	{ mergeStateStatus: "UNSTABLE" },
	{ mergeable: "UNKNOWN" },
	{ isDraft: true },
	{ headRefOid: "c".repeat(40) },
]) {
	effectApp(`refuses merge when host requirements change: ${JSON.stringify(override)}`, function* () {
		const fixture = scriptedGitHub([JSON.stringify({ ...pullRequest, ...override })]);
		const result = yield* Effect.flatMap(ChangeHost, (host) => host.merge({ ...work, requiredChecks: [] }, 12, revision)).pipe(
			Effect.provide(fixture.layer),
			Effect.exit,
		);
		expect(Exit.isFailure(result)).toBe(true);
		expect(fixture.calls).toHaveLength(1);
	});
}
for (const checks of [
	null,
	[
		{ __typename: "CheckRun", conclusion: "SUCCESS", name: "test", status: "COMPLETED" },
		{ __typename: "StatusContext", context: "test", state: "FAILURE" },
	],
]) {
	effectApp(`refuses missing or conflicting required checks: ${JSON.stringify(checks)}`, function* () {
		const fixture = scriptedGitHub([JSON.stringify({ ...pullRequest, statusCheckRollup: checks })]);
		const result = yield* Effect.flatMap(ChangeHost, (host) => host.merge(work, 12, revision)).pipe(Effect.provide(fixture.layer), Effect.exit);
		expect(Exit.isFailure(result)).toBe(true);
		expect(fixture.calls).toHaveLength(1);
	});
}
effectApp("rejects PRs outside approved repository and branch", function* () {
	for (const override of [{ url: "https://github.com/other/project/pull/12" }, { baseRefName: "release" }]) {
		const fixture = scriptedGitHub([JSON.stringify({ ...pullRequest, ...override })]);
		const result = yield* Effect.flatMap(ChangeHost, (host) => host.observe(work, 12)).pipe(Effect.provide(fixture.layer), Effect.exit);
		expect(Exit.isFailure(result)).toBe(true);
	}
});
effectApp("rejects command-like repository input before spawning", function* () {
	const fixture = scriptedGitHub([]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.observe({ ...work, repository: "--repo=other/project" }, 12)).pipe(
		Effect.provide(fixture.layer),
		Effect.exit,
	);
	expect(Exit.isFailure(result)).toBe(true);
	expect(fixture.calls).toHaveLength(0);
});
effectApp("preserves command failure and malformed response as typed failures", function* () {
	for (const output of ["not JSON", { code: 1, output: "private command diagnostic" }]) {
		const fixture = scriptedGitHub([output]);
		const result = yield* Effect.flatMap(ChangeHost, (host) => host.observe(work, 12)).pipe(Effect.provide(fixture.layer), Effect.exit);
		expect(Exit.isFailure(result)).toBe(true);
		expect(JSON.stringify(result)).not.toContain("private command diagnostic");
	}
});
effectApp("refuses delivery when an existing PR exceeds approved scope", function* () {
	const fixture = scriptedGitHub([JSON.stringify(pullRequest), ...checkoutResponses("other/unapproved.ts\0")]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.merge(work, 12, revision)).pipe(Effect.provide(fixture.layer), Effect.exit);
	expect(Exit.isFailure(result)).toBe(true);
	expect(fixture.calls.some((call) => call.args[1] === "merge")).toBe(false);
});
effectApp("refuses merge when the current base is not integrated into the reviewed head", function* () {
	const fixture = scriptedGitHub([JSON.stringify(pullRequest), ...checkoutResponses(), { code: 1, output: "" }]);
	const result = yield* Effect.flatMap(ChangeHost, (host) => host.merge(work, 12, revision)).pipe(Effect.provide(fixture.layer), Effect.exit);
	expect(Exit.isFailure(result)).toBe(true);
	expect(fixture.calls.some((call) => call.args[1] === "merge")).toBe(false);
});
