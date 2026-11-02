import { expect } from "@effect/vitest";
import { githubHost } from "#test/githubHostStory.ts";
import { completed, MOVED, work } from "#test/githubResult.ts";
import { refusal } from "#test/refusal.ts";

githubHost.it("adopts comparison paths when the PR count changes during observation", [], function* (github) {
	const fixture = github.result({ after: { "changed_files": 791 }, before: { "changed_files": 180 } });

	const adopted = yield* fixture.adopt(work, completed());

	expect(adopted).toMatchObject({ paths: ["src/one.ts", "src/two.ts"] });
});

githubHost.it("replaces duplicated PR file pages with unique comparison paths", [], function* (github) {
	const fixture = github.result({ files: [[{ filename: "src/one.ts" }, { filename: "src/one.ts" }]] });

	const adopted = yield* fixture.adopt(work, completed());

	expect(adopted).toMatchObject({ paths: ["src/one.ts", "src/two.ts"] });
});

for (const [verified, reason] of [
	[{ head: { sha: MOVED } }, "conflict: PR head moved after the worker report"],
	[{ base: { ref: "main", sha: MOVED } }, "conflict: PR base moved during changed-path comparison"],
] as const) {
	githubHost.it(`refuses a revision moving during comparison: ${reason}`, [], function* (github) {
		const fixture = github.result({ before: { "changed_files": 791 }, verified });

		const refused = yield* refusal(fixture.adopt(work, completed()));

		expect(refused).toBe(reason);
	});
}

githubHost.it("refuses the PR file endpoint's 3,000-file cap even when its count agrees", [], function* (github) {
	const fixture = github.result({
		after: { "changed_files": 3000 },
		before: { "changed_files": 3000 },
		comparison: { files: Array.from({ length: 300 }, (_, index) => ({ filename: `src/file-${index}.ts` })) },
		files: [Array.from({ length: 3000 }, (_, index) => ({ filename: `src/file-${index}.ts` }))],
	});

	const refused = yield* refusal(fixture.adopt(work, completed()));

	expect(refused).toBe(
		"unavailable: GitHub returned an incomplete changed-path observation: PR reports 3000 changed files; /files lists 3000; base/head comparison lists 300 files and may be truncated or duplicated",
	);
});
