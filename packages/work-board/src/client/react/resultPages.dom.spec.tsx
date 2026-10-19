import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import {
	answeredResult,
	CHECKED_RESULT,
	LONE_RESULT,
	ORPHAN_RESULT,
	QUIET_RESULT,
	QUIET_TASK,
	REVIEW_TASK,
	reviewResult,
	UNCHECKED_TASK,
} from "#test/resultReview.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { WIDE_TABLE, WIDE_TABLE_LAYOUT } from "#test/wideTableFixture.ts";

expectNoReactWarnings();

const PAGE_TITLE = "#doc [data-page-header] > h1";
const result = { "items/result.md": reviewResult(), "items/task.md": REVIEW_TASK };

screenStory.it(
	"heads a returned result with its plain status, links to its file and answer, and states what the Board does not verify",
	[routedScreen(result, "/_board/result?item=result.keyboard")],
	function* ({ findElement, findElements, readText, roles }) {
		yield* Effect.promise(() => eventually(() => expect(readText(PAGE_TITLE)).toBe("Review result")));
		expect(readText("[data-result-summary] [data-status-token]")).toBe("Finished");
		expect(findElement("[data-result-summary] [data-status-token] svg.lucide-check")).not.toBeNull();
		expect(findElements("[data-page-actions] :is(a, button)").map((control) => roles.accessible(control))).toEqual([
			{ name: "Open file", role: "link" },
		]);
		expect(findElement("[data-page-actions] a")?.getAttribute("href")).toBe("/items/result.md");
		expect(findElement("[data-page-actions] a")?.classList.contains("border-transparent")).toBe(false);
		expect(readText("#result-actions h2")).toBe("Your review");
		expect(findElements("#result-actions :is(a, button)").map((control) => roles.accessible(control))).toEqual([{ name: "Answer", role: "link" }]);
		expect(findElement("#result-actions a")?.getAttribute("href")).toBe("/_board/item/result.keyboard/#answer-card-review");
		expect(readText("#result-actions")).toContain("Review this exact result and its limitations.");
		expect(readText("#result-criteria")).toContain("the Board doesn't verify them");
		expect(readText('#result-feedback [data-slot="empty-title"]')).toBe("No feedback yet");
		expect(readText("[data-feedback-summary]")).toBe("Feedback: No feedback yet.");
		expect(findElement("[data-feedback-summary] a")).toBeNull();
		expect(readText("main")).not.toMatch(/SHA-256|Result status|source status/u);
	},
);

screenStory.it(
	"names the linked work with its title and status, dates the report and offers a follow-up handoff",
	[routedScreen(result, "/_board/result?item=result.keyboard")],
	function* ({ findElement, findElements, readText, roles }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-result-linked]")).not.toBeNull()));
		expect(readText("[data-result-linked] a[href='/_board/item/work.keyboard/']")).toBe("Keyboard work");
		expect(readText("[data-result-linked] [data-status-token]")).toBe("In review");
		const followUp = findElements("[data-result-linked] a").find(
			(link) => roles.accessible(link).name === "Prepare follow-up handoff for Keyboard work",
		);
		expect(followUp?.getAttribute("href")).toBe("/_board/handoff?item=work.keyboard");
		expect(findElement("[data-result-summary] time[data-modified]")).not.toBeNull();
		expect(readText("[data-result-summary] span:has(time)")).toBe(`updated ${readText("[data-result-summary] time")}`);
	},
);

screenStory.it(
	"collapses an empty review and empty checks into one line before the report",
	[routedScreen({ "items/result.md": QUIET_RESULT, "items/task.md": QUIET_TASK }, "/_board/result?item=result.quiet")],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-result-empty]")).not.toBeNull()));
		expect(readText("[data-result-empty]")).toBe("No review requested and no checks listed.");
		expect(findElement("#result-actions")).toBeNull();
		expect(findElement("#result-criteria")).toBeNull();
		const report = findElement("#result-report");
		expect(report && findElement("[data-result-empty]")?.compareDocumentPosition(report)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(readText("[data-result-linked] a")).toBe("Quiet work");
		expect(readText("[data-result-linked] [data-status-token]")).toBe("Done");
	},
);

screenStory.it(
	"keeps the review card and says in one line that no checks are listed",
	[routedScreen({ "items/result.md": reviewResult(), "items/task.md": UNCHECKED_TASK }, "/_board/result?item=result.keyboard")],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-result-empty]")).not.toBeNull()));
		expect(readText("[data-result-empty]")).toBe("No checks listed.");
		expect(readText("#result-actions h2")).toBe("Your review");
		expect(findElement("#result-actions a")?.getAttribute("href")).toBe("/_board/item/result.keyboard/#answer-card-review");
		expect(findElement("#result-criteria")).toBeNull();
	},
);

screenStory.it(
	"keeps the checks and says in one line that no review is requested",
	[routedScreen({ "items/result.md": CHECKED_RESULT, "items/task.md": REVIEW_TASK }, "/_board/result?item=result.checked")],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-result-empty]")).not.toBeNull()));
		expect(readText("[data-result-empty]")).toBe("No review requested.");
		expect(findElement("#result-actions")).toBeNull();
		expect(findElement("#result-criteria table")).not.toBeNull();
	},
);

screenStory.it(
	"shows no linked work row for a result that links to nothing",
	[routedScreen({ "items/result.md": LONE_RESULT }, "/_board/result?item=result.alone")],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-result-empty]")).not.toBeNull()));
		expect(readText("[data-result-empty]")).toBe("No review requested and no checks listed.");
		expect(findElement("[data-result-linked]")).toBeNull();
	},
);

screenStory.it(
	"names linked work that can't be read by its ID and offers no follow-up for it",
	[routedScreen({ "items/result.md": ORPHAN_RESULT }, "/_board/result?item=result.orphan")],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-result-linked]")).not.toBeNull()));
		expect(readText("[data-result-linked] li")).toBe("Forwork.missing (unresolved, ambiguous, or unavailable)");
		expect(findElement("[data-result-linked] a")).toBeNull();
		expect(findElements("#result-criteria section[aria-label]").map((section) => section.getAttribute("aria-label"))).toEqual(["work.missing"]);
		expect(readText("#result-criteria section[aria-label='work.missing'] a")).toBe("work.missing");
		expect(readText("#result-criteria section[aria-label='work.missing']")).toContain("This item can't be read");
	},
);

screenStory.it(
	"summarizes a single response written for an earlier report version",
	[routedScreen(answeredResult(true), "/_board/result?item=result.keyboard")],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() =>
			eventually(() => expect(findElements("#result-feedback article h3").map((author) => author.textContent)).toEqual(["first-reader"])),
		);
		expect(readText("[data-feedback-summary]")).toBe(
			`Feedback: 1 response. Latest: first-reader asked back ${readText("[data-feedback-summary] time")} on an earlier version. Jump to feedback`,
		);
		expect(findElement("[data-feedback-summary] time")?.getAttribute("datetime")).toBe("1970-01-01T00:00:02.000Z");
	},
);

screenStory.it(
	"summarizes feedback above the report and links down to it",
	[routedScreen(answeredResult(), "/_board/result?item=result.keyboard")],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(findElements("#result-feedback article h3").map((author) => author.textContent)).toEqual(["second-reader", "first-reader"]),
			),
		);
		expect(readText("[data-feedback-summary]")).toBe(
			`Feedback: 2 responses. Latest: second-reader answered ${readText("[data-feedback-summary] time")}. Jump to feedback`,
		);
		expect(findElement("[data-feedback-summary] time")?.getAttribute("datetime")).toBe("1970-01-01T00:00:03.000Z");
		expect(findElement("[data-feedback-summary] a")?.getAttribute("href")).toBe("#result-feedback");
		const report = findElement("#result-report");
		expect(report && findElement("[data-feedback-summary]")?.compareDocumentPosition(report)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	},
);

screenStory.it(
	"lists each linked check in a table, naming missing evidence and unrecorded details instead of leaving them blank",
	[routedScreen(result, "/_board/result?item=result.keyboard")],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#result-criteria table")).not.toBeNull()));
		expect(findElements("#result-criteria section[aria-label]").map((section) => section.getAttribute("aria-label"))).toEqual(["Keyboard work"]);
		expect(readText("#result-criteria section[aria-label='Keyboard work'] a")).toBe("Keyboard work");
		expect(readText("#result-criteria section[aria-label='Keyboard work'] [data-status-token]")).toBe("In review");
		expect(findElement("#result-criteria section[aria-label='Keyboard work'] [data-status-token] svg.lucide-loader-circle")).not.toBeNull();
		expect(findElements("#result-criteria th").map((cell) => cell.textContent)).toEqual([
			"Check",
			"Evidence",
			"Outcome",
			"Method",
			"Revision checked",
			"Observed",
		]);
		const rows = findElements("#result-criteria tbody tr").map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent));
		expect(rows).toEqual([
			[
				"Escape restores focus",
				"../evidence/focus.mdFile not found",
				"Focus restored in the recorded check",
				"Actual keyboard check",
				"012345678901",
				"Not recorded",
			],
			["Narrow layout stays readable", "No evidence recorded"],
		]);
		expect(findElement("#result-criteria tbody code")?.getAttribute("title")).toBe("Git revision 0123456789012345678901234567890123456789");
		expect(readText("#result-criteria")).not.toContain("Markdown source");
	},
);

screenStory.it(
	"warns that feedback may be missing when a response file can't be read",
	[routedScreen({ ...result, "responses/broken.md": "---\nresponse: [unfinished\n" }, "/_board/result?item=result.keyboard")],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#result-feedback [role='alert']")).not.toBeNull()));
		expect(readText("#result-feedback [role='alert']")).toContain("Some feedback couldn't be read");
		expect(readText("#result-feedback")).not.toContain("No feedback yet");
		expect(readText("[data-feedback-summary]")).toBe("Feedback: Some feedback couldn't be read. Jump to feedback");
	},
);

screenStory.it(
	"lays out a wide table in the report like a document table, scrolling inside its own box",
	[
		routedScreen(
			{ ...result, "items/result.md": reviewResult().replace("## Limits", `${WIDE_TABLE}\n## Limits`) },
			"/_board/result?item=result.keyboard",
		),
	],
	function* ({ findElement, readTableLayout }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#result-report table")).not.toBeNull()));
		expect(readTableLayout("#result-report table")).toEqual(WIDE_TABLE_LAYOUT);
	},
);
