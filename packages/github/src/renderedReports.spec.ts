import { expect } from "vitest";
import { github } from "#test/github.ts";
import { HEAD } from "#test/writeTraits.ts";
import { codeSpan, plainText, tableCell } from "./markdown.ts";
import { renderRows } from "./markdownRows.ts";

const HOSTILE = "`bad`` |\r\n<script>@org/team #123 [click](https://evil.test) 😀";
const REPORT = `${plainText("<b>@team #123 [link](url)</b>")}\n\n${codeSpan(HOSTILE)}\n\n${renderRows([`| ${tableCell(HOSTILE)} | ${tableCell(HOSTILE, "code")} |`], { header: "| Name | Error |\n| --- | --- |" })}`;
const LONG_REPORT = renderRows(Array.from({ length: 20_000 }, (_, index) => `| test ${index} | failed |`));

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
