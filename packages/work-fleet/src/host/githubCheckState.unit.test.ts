import { expect } from "@effect/vitest";
import { it } from "@shivaedev/test/it.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";

for (const conclusion of ["cancelled", "failure"]) {
	for (const reversed of [false, true]) {
		it.effect(`a newer passing run supersedes ${conclusion} across pages: reversed=${reversed}`, function* () {
			const fixture = githubFixture();
			fixture.required(["verify"]);
			const runs = [
				{ ...checkRun({ conclusion, name: "verify" }), completedAt: "2026-10-16T10:00:00Z", startedAt: "2026-10-16T09:00:00Z" },
				{ ...checkRun({ name: "verify" }), completedAt: "2026-10-16T11:00:00Z", startedAt: "2026-10-16T08:00:00Z" },
			];
			fixture.reply(
				ADOPTED_HEAD,
				(reversed ? runs.reverse() : runs).map((run) => [run]),
			);
			const checks = yield* fixture.checks(githubResult());
			expect(checks).toMatchObject({ failedChecks: [], passed: true, pending: false });
			expect(checks.evidence).toHaveLength(1);
			expect(checks.repairPrompt).toBeUndefined();
		});
	}
}

it.effect("a newer started run keeps validation pending until it completes", function* () {
	const fixture = githubFixture();
	fixture.required(["verify"]);
	const older = { ...checkRun({ name: "verify" }), completedAt: "2026-10-16T10:00:00Z", startedAt: "2026-10-16T09:00:00Z" };
	const newer = {
		...checkRun({ conclusion: null, name: "verify", status: "in_progress" }),
		completedAt: null,
		startedAt: "2026-10-16T11:00:00Z",
	};
	fixture.reply(ADOPTED_HEAD, [[older], [newer]]);
	expect(yield* fixture.checks(githubResult())).toMatchObject({ failedChecks: [], passed: false, pending: true });
	fixture.reply(ADOPTED_HEAD, [[older], [{ ...newer, completedAt: "2026-10-16T12:00:00Z", conclusion: "failure", status: "completed" }]]);
	expect(yield* fixture.checks(githubResult())).toMatchObject({ failedChecks: ["verify"], passed: false, pending: false });
});
