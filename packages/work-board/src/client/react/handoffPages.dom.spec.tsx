import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const PAGE_TITLE = "#doc [data-page-header] > h1";
const task = {
	"task.md": "---\nid: task.focus\nkind: task\nstatus: draft\nnext_action: Inspect focus\n---\n# Focus\n\nKeep the source readable.\n",
};

screenStory.it(
	"prepares a handoff in plain words, linking back to the item and keeping its actions as buttons",
	[routedScreen(task, "/_board/handoff?item=task.focus", { writable: true })],
	function* ({ findElement, findElements, readText, roles }) {
		yield* eventually(() => expect(readText(PAGE_TITLE)).toBe("Hand off: Focus"));
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
		yield* eventually(() => expect(findElement("#handoff-submit")).toHaveProperty("disabled", false));
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
		yield* eventually(() => expect(readText(PAGE_TITLE)).toBe("Hand off: Shipped work"));
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
	[routedScreen({ "task.md": "---\nid: task.plain\nkind: task\nstatus: draft\n---\nNo heading here.\n" }, "/_board/handoff?item=task.plain")],
	function* ({ findElement, readText }) {
		yield* eventually(() => expect(readText(PAGE_TITLE)).toBe("Hand off: task.plain"));
		expect(findElement<HTMLTextAreaElement>('[name="goal"]')?.value).toBe("task.plain");
	},
);

screenStory.it(
	"tells a read-only reader that saving is off and keeps Prepare handoff disabled",
	[routedScreen(task, "/_board/handoff?item=task.focus")],
	function* ({ findElement, readText, submit }) {
		yield* eventually(() => expect(findElement("main [role='alert']")).not.toBeNull());
		expect(readText("main [role='alert']")).toBe("Read-onlySaving handoffs is turned off on this Board.");
		expect(findElement("#handoff-submit")).toHaveProperty("disabled", true);
		submit("#handoff-form");
		expect(readText("#handoff-status")).toBe("");
		expect(readText("main")).not.toContain("--responses");
	},
);
