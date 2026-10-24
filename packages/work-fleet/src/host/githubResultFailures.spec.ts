import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { githubHost } from "#test/githubHostStory.ts";
import { BASE, completed, HEAD, MOVED, PR, REPORT, work } from "#test/githubResult.ts";

describe("typed result adoption failures", () => {
	for (const output of [
		"No PR line",
		`FLEET_HEAD: ${HEAD}\nFLEET_PR: soon`,
		`FLEET_HEAD: ${HEAD}\nFLEET_PR: https://example.test/pull/7`,
		`FLEET_PR: ${PR}`,
		`FLEET_HEAD: short\nFLEET_PR: ${PR}`,
		`FLEET_HEAD: ${HEAD}\n${REPORT}`,
		`${REPORT}\nFLEET_PR: none`,
		`${REPORT}\nextra text`,
		`FLEET_HEAD: ${HEAD}\nextra text\nFLEET_PR: ${PR}`,
		`FLEET_HEAD: ${HEAD}\nFLEET_PR: ${PR}\n \tFLEET_PR: none`,
		` \tFLEET_HEAD: ${HEAD}\n${REPORT}`,
		`FLEET_HEAD: \`${HEAD}\nFLEET_PR: ${PR}`,
	]) {
		githubHost.it(`rejects missing, malformed or ambiguous report lines: ${output}`, [], function* (github) {
			const fixture = github.result();
			expect(yield* fixture.adopt(work, completed(output)).pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
			expect(fixture.requests).toHaveLength(0);
		});
	}
	for (const before of [
		{ state: "closed" },
		{ merged: true },
		{ base: { ref: "other", sha: BASE } },
		{ number: 8 },
		{ base: { ref: "other", sha: BASE }, merged: true, state: "closed" },
		{ merged: true, number: 8, state: "closed" },
		{ "html_url": `${PR}0`, merged: true, state: "closed" },
	]) {
		githubHost.it(
			`rejects an unmerged closure, inconsistent merge, wrong-base or wrong-identity PR: ${JSON.stringify(before)}`,
			[],
			function* (github) {
				expect(yield* github.result({ before }).adopt(work, completed()).pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
			},
		);
	}
	githubHost.it("rejects a PR head that moved after the worker report", [], function* (github) {
		expect(
			yield* github
				.result({ before: { head: { sha: MOVED } } })
				.adopt(work, completed())
				.pipe(Effect.flip),
		).toMatchObject({ _tag: "Conflict" });
	});
	for (const after of [{ head: { sha: MOVED } }, { base: { ref: "other", sha: MOVED } }, { "changed_files": 3 }, { state: "closed" }]) {
		githubHost.it(`rejects movement or closure during path observation: ${JSON.stringify(after)}`, [], function* (github) {
			expect(yield* github.result({ after }).adopt(work, completed()).pipe(Effect.flip)).toMatchObject({
				_tag: "state" in after || "base" in after ? "BadRequest" : "Conflict",
			});
		});
	}
	githubHost.it("rejects a report for another repository", [], function* (github) {
		const fixture = github.result();
		expect(yield* fixture.adopt(work, completed(REPORT.replace("example/repository", "other/repository"))).pipe(Effect.flip)).toMatchObject({
			_tag: "BadRequest",
		});
		expect(fixture.requests).toEqual([]);
	});
	for (const files of [[[{ filename: "src/one.ts" }]], [[{ filename: "src/one.ts" }, { filename: "src/one.ts" }]]]) {
		githubHost.it("rejects incomplete or duplicate file pages", [], function* (github) {
			expect(yield* github.result({ files }).adopt(work, completed()).pipe(Effect.flip)).toMatchObject({ _tag: "ServiceUnavailable" });
		});
	}
	for (const options of [{ before: { head: { sha: "short" } } }, { invalidJson: true }, { unavailable: true }]) {
		githubHost.it(`fails typed for unavailable or invalid GitHub observations: ${JSON.stringify(options)}`, [], function* (github) {
			expect(yield* github.result(options).adopt(work, completed()).pipe(Effect.flip)).toMatchObject({ _tag: "ServiceUnavailable" });
		});
	}
	githubHost.it("does not adopt a running worker", [], function* (github) {
		const fixture = github.result();
		expect(yield* fixture.adopt(work, { ...completed(), execution: "running" }).pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
		expect(fixture.requests).toHaveLength(0);
	});
});
