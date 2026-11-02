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

github.it("a 20,000-row report at the default budget fits GitHub's 65,536-character comment limit with its marker", [], function* ({ postReport }) {
	expect(yield* postReport({ body: LONG_REPORT, marker: "report" })).toMatchObject({ body: `<!-- report -->\n${LONG_REPORT}` });
});

github.it("a 20,000-row report at the default budget fits GitHub's 65,535-character check summary limit", [], function* ({ createCheck }) {
	expect(yield* createCheck({ headSha: HEAD, name: "Tests", output: { summary: LONG_REPORT, title: "Tests" }, status: "in_progress" })).toMatchObject(
		{
			output: { summary: LONG_REPORT },
		},
	);
});
