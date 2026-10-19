import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { REVIEW_TASK, reviewResult } from "#test/resultReview.ts";
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
		expect(readText("#result-feedback")).toContain("No feedback yet.");
		expect(readText("main")).not.toMatch(/SHA-256|Result status|source status/u);
	},
);

screenStory.it(
	"lists each linked check in a table, naming missing evidence and unrecorded details instead of leaving them blank",
	[routedScreen(result, "/_board/result?item=result.keyboard")],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#result-criteria table")).not.toBeNull()));
		expect(findElements("#result-criteria section[aria-label]").map((section) => section.getAttribute("aria-label"))).toEqual(["work.keyboard"]);
		expect(readText("#result-criteria section[aria-label='work.keyboard'] [data-status-token]")).toBe("In review");
		expect(findElement("#result-criteria section[aria-label='work.keyboard'] [data-status-token] svg.lucide-loader-circle")).not.toBeNull();
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
		expect(readText("#result-feedback")).not.toContain("No feedback yet.");
	},
);

screenStory.it(
	"prepares a handoff in plain words, linking back to the item and keeping its actions as buttons",
	[routedScreen(task, "/_board/handoff?item=task.focus", { writable: true })],
	function* ({ findElement, findElements, readText, roles }) {
		yield* Effect.promise(() => eventually(() => expect(readText(PAGE_TITLE)).toBe("Hand off to an agent")));
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
			{ name: "Preview file", role: "button" },
			{ name: "Prepare handoff", role: "button" },
			{ name: "Clear draft", role: "button" },
		]);
		expect(readText("#handoff-status")).toBe("Preview the file, then prepare the handoff.");
		expect(findElement("main [role='alert']")).toBeNull();
		expect(readText("#handoff-history")).toContain("No handoffs yet.");
	},
);

screenStory.it(
	"tells a read-only reader that saving is off and keeps Prepare handoff disabled",
	[routedScreen(task, "/_board/handoff?item=task.focus")],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("main [role='alert']")).not.toBeNull()));
		expect(readText("main [role='alert']")).toBe("Read-onlySaving handoffs is turned off on this Board.");
		expect(findElement("#handoff-submit")).toHaveProperty("disabled", true);
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
