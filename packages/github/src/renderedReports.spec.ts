import { expect } from "vitest";
import { github } from "#test/github.ts";
import { LONG_REPORT, REPORT } from "#test/renderedReports.ts";
import { HEAD } from "#test/writeTraits.ts";

github.it("a report rendered from hostile text reaches the pull request comment unchanged", [], function* ({ commentsOnPullRequest, postReport }) {
	yield* postReport({ body: REPORT, marker: "report" });

	expect(yield* commentsOnPullRequest()).toEqual([`coverage[bot]: <!-- report -->\n${REPORT}`]);
});

github.it("a report rendered from hostile text reaches the check summary unchanged", [], function* ({ checkOnGitHub, createCheck }) {
	yield* createCheck({ headSha: HEAD, name: "Tests", output: { summary: REPORT, title: "Tests" }, status: "in_progress" });

	expect(yield* checkOnGitHub(1)).toMatchObject({ output: { summary: REPORT } });
});

github.it("a 20,000-row report reaches the outbound comment unchanged with its marker", [], function* ({ commentMutations, postReport }) {
	yield* postReport({ body: LONG_REPORT, marker: "report" });

	expect(yield* commentMutations()).toEqual([
		{ body: { body: `<!-- report -->\n${LONG_REPORT}` }, method: "POST", path: "/repos/acme/widgets/issues/1/comments" },
	]);
});

github.it("a 20,000-row report reaches the outbound check summary unchanged", [], function* ({ checkMutations, createCheck }) {
	yield* createCheck({ headSha: HEAD, name: "Tests", output: { summary: LONG_REPORT, title: "Tests" }, status: "in_progress" });

	expect(yield* checkMutations()).toEqual([
		{
			body: { "head_sha": HEAD, name: "Tests", output: { summary: LONG_REPORT, title: "Tests" }, status: "in_progress" },
			method: "POST",
			path: "/repos/acme/widgets/check-runs",
		},
	]);
});
