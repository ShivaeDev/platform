import { Effect } from "effect";
import { describe, expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { FILES, PLAN, waitFor } from "#test/live.ts";

const liveProject = [projectFiles(FILES), boardHome("board.md")];

describe("live page", () => {
	// Guards shell boot and delivery of a live document update.
	boardStory.it("swaps an edited file into the open page without reloading it", liveProject, function* ({ openLivePage, paragraph, editFile }) {
		const page = yield* openLivePage("/plan.md");
		const intro = paragraph("Intro.");
		expect(intro).toBeDefined();
		const details = page.document.querySelector("#doc details");
		if (details === null) {
			throw new Error("the page has no details block");
		}
		details.setAttribute("open", "");
		page.document.body.dataset.visit = "first";
		editFile("plan.md", PLAN.replace("A closing line.", "A changed line."));
		yield* Effect.promise(() => waitFor(() => expect(paragraph("A changed line.")).toBeDefined()));
		expect(page.document.body.dataset.visit).toBe("first");
		expect(paragraph("Intro.")).toBe(intro);
		expect(page.document.querySelector("#doc details")?.hasAttribute("open")).toBe(true);
	});
});
