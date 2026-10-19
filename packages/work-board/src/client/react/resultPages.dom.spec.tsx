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

expectNoReactWarnings();

const PAGE_TITLE = "#doc [data-page-header] > h1";
const result = { "items/result.md": reviewResult(), "items/task.md": REVIEW_TASK };
const task = {
	"task.md": "---\nid: task.focus\nkind: task\nstatus: planned\nnext_action: Inspect focus\n---\n# Focus\n\nKeep the source readable.\n",
};

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
		expect(readText("[data-result-summary] time")).toMatch(/^updated \d+[smhd] ago$/u);
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
	function* ({ findElements, readText }) {
		yield* Effect.promise(() =>
			eventually(() => expect(findElements("#result-feedback article h3").map((author) => author.textContent)).toEqual(["first-reader"])),
		);
		expect(readText("[data-feedback-summary]")).toMatch(
			/^Feedback: 1 response\. Latest: first-reader asked back \d+[smhd] ago on an earlier version\. Jump to feedback$/u,
		);
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
		expect(readText("[data-feedback-summary]")).toMatch(/^Feedback: 2 responses\. Latest: second-reader answered \d+[smhd] ago\. Jump to feedback$/u);
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
	"prepares a handoff in plain words, linking back to the item and keeping its actions as buttons",
	[routedScreen(task, "/_board/handoff?item=task.focus", { writable: true })],
	function* ({ findElement, findElements, readText, roles }) {
		yield* Effect.promise(() => eventually(() => expect(readText(PAGE_TITLE)).toBe("Hand off: Focus")));
		expect(findElements("[data-page-actions] :is(a, button)").map((control) => roles.accessible(control))).toEqual([
			{ name: "Back to item", role: "link" },
		]);
		expect(findElement("[data-page-actions] a")?.getAttribute("href")).toBe("/_board/item/task.focus/");
		expect(readText(".response-context")).toContain("Keep the source readable.");
		expect(findElements("#handoff-form label").map((label) => label.textContent)).toEqual([
			"Agent name",
			"Goal",
			"Constraints (optional)",
			"Next step",
		]);
		expect(findElements("#handoff-form button").map((control) => roles.accessible(control))).toEqual([
			{ name: "Prepare handoff", role: "button" },
			{ name: "Preview file", role: "button" },
			{ name: "Clear draft", role: "button" },
		]);
		yield* Effect.promise(() => eventually(() => expect(findElement("#handoff-submit")).toHaveProperty("disabled", false)));
		expect(findElement("#handoff-submit")?.classList.contains("bg-primary")).toBe(false);
		expect(readText("#handoff-status")).toBe("");
		expect(findElement<HTMLInputElement>('[name="nextAction"]')?.value).toBe("Inspect focus");
		expect(findElement("main [role='alert']")).toBeNull();
		expect(readText('#handoff-history [data-slot="empty-title"]')).toBe("No handoffs yet");
	},
);

screenStory.it(
	"names the item's owner as the agent and leaves a done item's old next step empty",
	[
		routedScreen(
			{ "task.md": "---\nid: task.shipped\nkind: task\nstatus: done\nowner: codex\nnext_action: Done; PR #395 merged.\n---\n# Shipped work\n" },
			"/_board/handoff?item=task.shipped",
			{ writable: true },
		),
	],
	function* ({ activate, findElement, input, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText(PAGE_TITLE)).toBe("Hand off: Shipped work")));
		expect(findElement<HTMLInputElement>('[name="recipient"]')?.value).toBe("codex");
		const next = findElement<HTMLTextAreaElement>('[name="nextAction"]');
		expect(next?.value).toBe("");
		expect(next?.placeholder).toBe("What should the agent do first?");
		const goal = input('[name="goal"]', "A different direction");
		yield* Effect.promise(() => activate("#handoff-clear"));
		expect(readText("#handoff-status")).toBe("Draft cleared. Saved handoffs are unchanged.");
		expect(goal.value).toBe("Shipped work");
	},
);

screenStory.it(
	"titles a handoff by the item ID when the item has no heading",
	[routedScreen({ "task.md": "---\nid: task.plain\nkind: task\nstatus: planned\n---\nNo heading here.\n" }, "/_board/handoff?item=task.plain")],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText(PAGE_TITLE)).toBe("Hand off: task.plain")));
		expect(findElement<HTMLTextAreaElement>('[name="goal"]')?.value).toBe("task.plain");
	},
);

screenStory.it(
	"tells a read-only reader that saving is off and keeps Prepare handoff disabled",
	[routedScreen(task, "/_board/handoff?item=task.focus")],
	function* ({ findElement, readText, submit }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("main [role='alert']")).not.toBeNull()));
		expect(readText("main [role='alert']")).toBe("Read-onlySaving handoffs is turned off on this Board.");
		expect(findElement("#handoff-submit")).toHaveProperty("disabled", true);
		submit("#handoff-form");
		expect(readText("#handoff-status")).toBe("");
		expect(readText("main")).not.toContain("--responses");
	},
);

screenStory.it(
	"starts an empty workspace with steps and copyable template cards",
	[routedScreen({}, "/_board/start")],
	function* ({ findElement, findElements, readText, roles }) {
		yield* Effect.promise(() => eventually(() => expect(readText(PAGE_TITLE)).toBe("Start your workspace")));
		expect(findElements("main ol li").map((step) => step.textContent)).toEqual([
			"Copy a template below.",
			"Save it in this folder under the suggested name.",
			"Change the example IDs to your own, and update the links that use them.",
			"Fill in the real details. Start with the project, then the investigation and the result.",
		]);
		const cards = findElements(".start-template");
		expect(cards.map((card) => card.querySelector("h2")?.textContent)).toEqual(["Project", "Investigation", "Agent result"]);
		expect(readText(".start-template [data-slot='card-description']")).toBe("Save as project.md");
		yield* roles.click({ name: "Copy project template", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(readText(".start-template [data-copy-status]")).toBe("Copied. Save it as project.md.")));
		const template = findElement<HTMLTextAreaElement>("#template-project\\.md");
		expect(yield* Effect.promise(() => navigator.clipboard.readText())).toBe(template?.value);
	},
);
