import { expect } from "@effect/vitest";
import { githubHost } from "#test/githubHostStory.ts";
import { completed, HEAD, MOVED, REPORT, work } from "#test/githubResult.ts";
import { refusal } from "#test/refusal.ts";

githubHost.it("adopts local comparison paths when the PR count changes during observation", [], function* (github) {
	const fixture = yield* github.localResult({ after: { "changed_files": 791 }, before: { "changed_files": 180 } });

	const adopted = yield* fixture.adopt(work, completed(REPORT.replace(HEAD, fixture.head)));

	expect(adopted).toMatchObject({ paths: ["src/deleted.ts", "src/old.ts", "src/one.ts", "src/renamed\tfile.ts", "src/two.ts"] });
});

githubHost.it("replaces duplicated PR file pages with local comparison paths", [], function* (github) {
	const fixture = yield* github.localResult({
		after: { "changed_files": 2 },
		before: { "changed_files": 2 },
		files: [[{ filename: "src/one.ts" }, { filename: "src/one.ts" }]],
	});

	const adopted = yield* fixture.adopt(work, completed(REPORT.replace(HEAD, fixture.head)));

	expect(adopted).toMatchObject({ paths: ["src/deleted.ts", "src/old.ts", "src/one.ts", "src/renamed\tfile.ts", "src/two.ts"] });
});

for (const [verified, reason] of [
	[{ head: { sha: MOVED } }, "conflict: PR head moved after the worker report"],
	[{ base: { ref: "main", sha: MOVED } }, "conflict: PR base moved during changed-path comparison"],
] as const) {
	githubHost.it(`refuses a revision moving during comparison: ${reason}`, [], function* (github) {
		const fixture = yield* github.localResult({ verified });

		const refused = yield* refusal(fixture.adopt(work, completed(REPORT.replace(HEAD, fixture.head))));

		expect(refused).toBe(reason);
	});
}
