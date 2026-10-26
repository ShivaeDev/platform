import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import {
	ambiguousQuestion,
	answeredResult,
	CHECKED_RESULT,
	LONE_RESULT,
	ORPHAN_RESULT,
	QUIET_RESULT,
	QUIET_TASK,
	REVIEW_TASK,
	relatedProblems,
	reviewResult,
	UNCHECKED_TASK,
	unrelatedProblems,
} from "#test/resultReview.ts";
import { failingRead } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen, routedScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const ITEM = "/_board/item/result.keyboard/";
const REPORT = "#doc article[data-source]";
// The workspace's first file opens as its home board, so a note keeps each result on its ordinary item page.
const HOME = { "README.md": "# Workspace\n" };
const result = { ...HOME, "items/result.md": reviewResult(), "items/task.md": REVIEW_TASK };

screenStory.it(
	"puts the review request, checks and feedback above the report on the result's own page",
	[routedScreen(result, ITEM)],
	function* ({ findElement, findElements, readOrder, readText, roles }) {
		yield* eventually(() => expect(findElement("#result-review")).not.toBeNull());
		expect(findElements("#doc h1").map((heading) => heading.textContent)).toEqual(["First report"]);
		expect(findElements("[data-page-actions] :is(a, button)").map((control) => roles.accessible(control).name)).not.toContain(
			"Review returned result",
		);
		expect(readOrder(REPORT, "[data-result-empty]", "#result-criteria", "#answer-card-review")).toEqual([
			"#answer-card-review",
			"#result-criteria",
			"[data-result-empty]",
			REPORT,
		]);
		expect(readText("#result-criteria")).toContain("the Board doesn't verify them");
		expect(readText("[data-result-empty]")).toBe("No feedback yet.");
		expect(findElement("#result-feedback")).toBeNull();
	},
);

screenStory.it(
	"names the linked work with its title and status and offers a follow-up handoff",
	[routedScreen(result, ITEM)],
	function* ({ findElement, findElements, readText, roles }) {
		yield* eventually(() => expect(findElement("[data-result-linked]")).not.toBeNull());
		expect(readText("[data-result-linked] a[href='/_board/item/work.keyboard/']")).toBe("Keyboard work");
		expect(readText("[data-result-linked] [data-status-token]")).toBe("Ready");
		const followUp = findElements("[data-result-linked] a").find(
			(link) => roles.accessible(link).name === "Prepare follow-up handoff for Keyboard work",
		);
		expect(followUp?.getAttribute("href")).toBe("/_board/handoff?item=work.keyboard");
	},
);

screenStory.it(
	"collapses an empty review, empty checks and missing feedback into one line before the report",
	[routedScreen({ ...HOME, "items/result.md": QUIET_RESULT, "items/task.md": QUIET_TASK }, "/_board/item/result.quiet/")],
	function* ({ findElement, readOrder, readText }) {
		yield* eventually(() => expect(findElement("[data-result-empty]")).not.toBeNull());
		expect(readText("[data-result-empty]")).toBe("No review requested, no checks listed and no feedback yet.");
		expect(findElement(".answer-cards")).toBeNull();
		expect(findElement("#result-criteria")).toBeNull();
		expect(readOrder(REPORT, "[data-result-empty]")).toEqual(["[data-result-empty]", REPORT]);
		expect(readText("[data-result-linked] a")).toBe("Quiet work");
		expect(readText("[data-result-linked] [data-status-token]")).toBe("Done");
	},
);

screenStory.it(
	"keeps the review request and says in one line that no checks are listed",
	[routedScreen({ ...HOME, "items/result.md": reviewResult(), "items/task.md": UNCHECKED_TASK }, ITEM)],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(findElement("[data-result-empty]")).not.toBeNull());
		expect(readText("[data-result-empty]")).toBe("No checks listed and no feedback yet.");
		expect(findElement("#answer-card-review")).not.toBeNull();
		expect(findElement("#result-criteria")).toBeNull();
	},
);

screenStory.it(
	"keeps the checks and says in one line that no review is requested",
	[routedScreen({ ...HOME, "items/result.md": CHECKED_RESULT, "items/task.md": REVIEW_TASK }, "/_board/item/result.checked/")],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(findElement("[data-result-empty]")).not.toBeNull());
		expect(readText("[data-result-empty]")).toBe("No review requested and no feedback yet.");
		expect(findElement(".answer-cards")).toBeNull();
		expect(findElement("#result-criteria table")).not.toBeNull();
	},
);

screenStory.it(
	"shows no linked work row for a result that links to nothing",
	[routedScreen({ ...HOME, "items/result.md": LONE_RESULT }, "/_board/item/result.alone/")],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(findElement("[data-result-empty]")).not.toBeNull());
		expect(readText("[data-result-empty]")).toBe("No review requested, no checks listed and no feedback yet.");
		expect(findElement("[data-result-linked]")).toBeNull();
	},
);

screenStory.it(
	"names linked work that can't be read by its ID and offers no follow-up for it",
	[routedScreen({ ...HOME, "items/result.md": ORPHAN_RESULT }, "/_board/item/result.orphan/")],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElement("[data-result-linked]")).not.toBeNull());
		expect(readText("[data-result-linked] li")).toBe("Forwork.missing (unresolved, ambiguous, or unavailable)");
		expect(findElement("[data-result-linked] a")).toBeNull();
		expect(findElements("#result-criteria section[aria-label]").map((section) => section.getAttribute("aria-label"))).toEqual(["work.missing"]);
		expect(readText("#result-criteria section[aria-label='work.missing'] a")).toBe("work.missing");
		expect(readText("#result-criteria section[aria-label='work.missing']")).toContain("This item can't be read");
	},
);

screenStory.it(
	"dates feedback written for an earlier report by when it was reviewed instead of a hash",
	[routedScreen({ ...HOME, ...answeredResult(true) }, ITEM)],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElements("#result-feedback article h3").map((author) => author.textContent)).toEqual(["first-reader"]));
		expect(readText("#result-feedback [data-reviewed-version]")).toBe(
			`Written for an earlier or moved version of items/result.md, as it was ${readText("#result-feedback [data-reviewed-version] time")}. It doesn't apply to this version automatically.`,
		);
		expect(findElement("#result-feedback [data-reviewed-version] time")?.getAttribute("datetime")).toBe("1970-01-01T00:00:01.000Z");
		expect(findElement("#result-feedback [data-reviewed-version] code")).toBeNull();
	},
);

screenStory.it(
	"dates feedback on the shown report by when the report was received and keeps the full hash to copy",
	[routedScreen({ ...HOME, ...answeredResult() }, ITEM)],
	function* ({ findElement, findElements, readOrder, readText }) {
		yield* eventually(() =>
			expect(findElements("#result-feedback article h3").map((author) => author.textContent)).toEqual(["second-reader", "first-reader"]),
		);
		expect(readOrder(REPORT, "#result-review #result-feedback")).toEqual(["#result-review #result-feedback", REPORT]);
		expect(findElement("[data-result-empty]")).toBeNull();
		const versions = findElements("#result-feedback [data-reviewed-version]");
		expect(versions.map((line) => line.textContent)).toEqual(
			versions.map((line) => `Written for the version of items/result.md shown here, received ${line.querySelector("time")?.textContent}.`),
		);
		const received = findElement("#result-feedback [data-reviewed-version] time")?.getAttribute("datetime");
		expect(received).toBe(findElement("#doc [data-page-header] time[data-modified]")?.getAttribute("datetime"));
		expect(readText("#result-feedback details code")).toMatch(/^[a-f\d]{64}$/u);
	},
);

screenStory.it(
	"lists each linked check in a table, naming missing evidence and unrecorded details instead of leaving them blank",
	[routedScreen(result, ITEM)],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElement("#result-criteria table")).not.toBeNull());
		expect(findElements("#result-criteria section[aria-label]").map((section) => section.getAttribute("aria-label"))).toEqual(["Keyboard work"]);
		expect(readText("#result-criteria section[aria-label='Keyboard work'] a")).toBe("Keyboard work");
		expect(readText("#result-criteria section[aria-label='Keyboard work'] [data-status-token]")).toBe("Ready");
		expect(findElement("#result-criteria section[aria-label='Keyboard work'] [data-status-token] svg.lucide-circle")).not.toBeNull();
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
	"names each feedback file that can't be read, says why and links to System's source problems",
	[routedScreen({ ...result, ...relatedProblems(), "responses/broken.md": "---\nresponse: [unfinished\n" }, ITEM)],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElement("#result-feedback [role='alert']")).not.toBeNull());
		expect(readText("#result-feedback [role='alert']")).toContain("Some feedback couldn't be read");
		const files = findElements("[data-unreadable-feedback] li");
		expect(files.map((file) => file.querySelector("a")?.getAttribute("href"))).toEqual([
			"/responses/broken.md",
			"/responses/no-record.md",
			"/responses/question.edited.md",
		]);
		expect(files.map((file) => file.textContent)).toEqual([
			expect.stringMatching(/^responses\/broken\.md: \S/u),
			"responses/no-record.md: It's marked as a response but has no ID or response record.",
			"responses/question.edited.md: It's marked as a question but its record doesn't match its text.",
		]);
		expect(findElement("#result-feedback [role='alert'] a[href='/_board/system#source-problems']")?.textContent).toBe(
			"See source problems in System",
		);
		expect(readText("#result-review")).not.toContain("No feedback yet");
	},
);

screenStory.it(
	"names each question whose feedback can't be read when no broken file explains it",
	[routedScreen({ ...HOME, ...ambiguousQuestion() }, ITEM)],
	function* ({ findElement, findElements }) {
		yield* eventually(() => expect(findElement("[data-unreadable-feedback]")).not.toBeNull());
		expect(findElements("[data-unreadable-feedback] li a").map((link) => link.getAttribute("href"))).toEqual([
			expect.stringMatching(/^\/questions\/copy-of-question\.[a-f\d]{64}\.md$/u),
			expect.stringMatching(/^\/responses\/question\.[a-f\d]{64}\.md$/u),
		]);
		expect(findElements("[data-unreadable-feedback] li").map((file) => file.textContent?.replace(/^\S+: /u, ""))).toEqual([
			"The registered question identity is ambiguous; response history is unknown.",
			"The registered question identity is ambiguous; response history is unknown.",
		]);
		expect(findElement("#result-feedback article")).toBeNull();
	},
);

screenStory.it(
	"keeps showing feedback when only files about other work are broken, leaving them to System",
	[routedScreen({ ...HOME, ...answeredResult(), ...unrelatedProblems() }, ITEM)],
	function* ({ findElement, findElements }) {
		yield* eventually(() =>
			expect(findElements("#result-feedback article h3").map((author) => author.textContent)).toEqual(["second-reader", "first-reader"]),
		);
		expect(findElement("[data-unreadable-feedback]")).toBeNull();
	},
);

screenStory.it(
	"says in plain words when checks and feedback can't be shown while the report still reads",
	[screenFiles(result), failingRead(ITEM), screenRoute("/items/result.md"), openScreen()],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(findElement("[data-result-unavailable]")).not.toBeNull());
		expect(readText("[data-result-unavailable]")).toBe("Checks and feedback can't be shown. Reload the page to try again.");
		expect(readText(REPORT)).toContain("Narrow-screen evidence is not recorded.");
		expect(findElement("#result-feedback")).toBeNull();
	},
);
