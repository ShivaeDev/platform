import { Effect } from "effect";
import { expect } from "vitest";
import { boardFilesystem, boardHome, boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { enterField } from "#test/enterField.ts";
import { silentWatch } from "#test/faults.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";

boardStory.it(
	"retains the response draft and exposes the precise real HTTP rejection when source changes after preview",
	[projectFiles({ "item.md": EDGE_ATTENTION_SOURCE }), boardHome(undefined), responsesEnabled(true), boardFilesystem(silentWatch)],
	function* ({ notes, reader }) {
		const page = yield* reader.open("/_board/respond?item=item.edge&request=direction");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false)));
		yield* formEvent(page, () => enterField(page, "author", "reviewer"));
		const body = enterField(page, "body", "Retain these conditions.");
		yield* formEvent(page, () => reader.click("response-preview"));
		expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
		notes.write("item.md", `${EDGE_ATTENTION_SOURCE}Changed context.\n`);
		yield* reader.submit("response-form");
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.getElementById("response-status")?.getAttribute("data-outcome")).toBe("rejected")),
		);
		expect(page.document.getElementById("response-status")?.textContent).toBe(
			"Rejected: PreconditionFailed: Source changed since review. Read it again before registering this question.. Draft retained. Preview and retry with the same identity; saved content will be reconciled.",
		);
		expect(body.value).toBe("Retain these conditions.");
	},
);

boardStory.it(
	"retains handoff direction and requires a fresh preview when source changes after preview",
	[projectFiles({ "item.md": EDGE_ATTENTION_SOURCE }), boardHome(undefined), responsesEnabled(true), boardFilesystem(undefined)],
	function* ({ notes, reader }) {
		const page = yield* reader.open("/_board/handoff?item=item.edge");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("handoff-preview")?.hasAttribute("disabled")).toBe(false)));
		yield* formEvent(page, () => enterField(page, "recipient", "agent-local"));
		yield* formEvent(page, () => enterField(page, "goal", "Retain this direction."));
		yield* formEvent(page, () => reader.click("handoff-preview"));
		expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(false);
		notes.write("item.md", `${EDGE_ATTENTION_SOURCE}Changed context.\n`);
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".response-context")?.textContent).toContain("Changed context.")));
		expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(true);
		expect(page.document.getElementById("handoff-status")?.textContent).toBe(
			"Source changed since this draft. Your text is retained; review the new source and preview to bind it to this revision.",
		);
		expect(page.document.querySelector('[name="goal"]')).toHaveProperty("value", "Retain this direction.");
		expect(page.document.querySelector('[name="recipient"]')).toHaveProperty("value", "agent-local");
		yield* formEvent(page, () => reader.click("handoff-preview"));
		expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(false);
	},
);
