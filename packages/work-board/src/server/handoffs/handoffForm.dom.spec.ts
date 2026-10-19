import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, readerAt } from "#test/boardStory.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";
import { libraryCount } from "#test/nativeRpc.ts";
import { aHandoffTask, anAnswerForm, clipboardUnavailable } from "#test/storyTraits.ts";

const SOURCE = "---\nid: task.focus\nkind: task\nnext_action: Inspect focus\n---\n# Focus\n\nReviewed source.\n";

const EXPECTED_LIBRARY_COUNT = 2;

boardStory.it(
	"preserves the owned handoff draft on live reads and requires preview after a changed reviewed source",
	[aHandoffTask(SOURCE, "item.md"), readerAt("/_board/handoff?item=task.focus"), anAnswerForm("handoff")],
	function* ({ board, page, reader, editFile }) {
		reader.input("recipient", "agent-local");
		const goal = reader.input("goal", "Keep my direction.");
		yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
		expect(page.document.querySelector('[name="goal"]')).toBe(goal);
		editFile("unrelated.md", "# Another file\n");
		yield* Effect.promise(() => waitFor(async () => expect(await Effect.runPromise(libraryCount(board))).toBe(EXPECTED_LIBRARY_COUNT)));
		expect(page.document.querySelector('[name="goal"]')).toBe(goal);
		yield* formEvent(page, () => reader.click("handoff-preview"));
		expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(false);
		editFile("item.md", SOURCE.replace("Reviewed source.", "Changed premise."));
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".response-context")?.textContent).toContain("Changed premise")));
		expect(reader.fieldValue("goal")).toBe("Keep my direction.");
		expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(true);
	},
);

boardStory.it(
	"prepares through native commands and retains the selected manual-copy prompt when clipboard access is unavailable",
	[aHandoffTask(SOURCE, "item.md"), readerAt("/_board/handoff?item=task.focus"), clipboardUnavailable(), anAnswerForm("handoff")],
	function* ({ page, reader }) {
		reader.input("recipient", "agent-local");
		reader.input("goal", "Fix focus");
		yield* formEvent(page, () => reader.click("handoff-preview"));
		yield* reader.submit("handoff-form");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("handoff-status")?.textContent).toContain("Saved handoffs/")));
		expect(page.document.getElementById("handoff-status")?.textContent).toContain("Copy the prompt below into your agent session");
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("#handoff-prepared [data-handoff-copy]")).not.toBeNull()));
		const button = page.document.querySelector("#handoff-prepared [data-handoff-copy]");
		yield* formEvent(page, () => button?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true })));
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.querySelector("#handoff-prepared [data-copy-status]")?.textContent).toContain("selected")),
		);
		const field = page.document.querySelector("#handoff-prepared textarea");
		if (!(field instanceof page.window.HTMLTextAreaElement)) {
			throw new Error("Missing copy prompt");
		}
		expect(field?.value).toContain("Record receipt");
		expect(field?.selectionStart).toBe(0);
		expect(field?.selectionEnd).toBe(field?.value.length);
	},
);

boardStory.it(
	"uses native navigation and restores a handoff draft across Back without losing the browser session",
	[aHandoffTask(SOURCE, "item.md"), readerAt("/_board/handoff?item=task.focus"), anAnswerForm("handoff")],
	function* ({ page, reader }) {
		reader.input("recipient", "agent-local");
		reader.input("goal", "Retain this direction across navigation");
		yield* Effect.promise(() => waitFor(() => expect(page.window.history.state).toHaveProperty("workBoard.id")));
		page.document.body.dataset.visit = "kept";
		yield* reader.follow("/item.md");
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('a[href="/_board/handoff?item=task.focus"]')).not.toBeNull()));
		yield* formEvent(page, () =>
			page.document
				.querySelector('a[href="/_board/handoff?item=task.focus"]')
				?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true })),
		);
		yield* Effect.promise(() => waitFor(() => expect(reader.fieldValue("goal")).toBe("Retain this direction across navigation")));
		expect(page.document.body.dataset.visit).toBe("kept");
		expect(reader.fieldValue("goal")).toBe("Retain this direction across navigation");
		page.window.history.back();
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('a[href="/_board/handoff?item=task.focus"]')).not.toBeNull()));
		page.window.history.back();
		yield* Effect.promise(() => waitFor(() => expect(reader.fieldValue("goal")).toBe("Retain this direction across navigation")));
		expect(reader.fieldValue("goal")).toBe("Retain this direction across navigation");
	},
);
