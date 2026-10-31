import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { FILES, PLAN } from "#test/live.ts";

boardStory.it(
	"an edit to the open file swaps in the changed text without reloading the page, keeping unchanged paragraphs and an opened details block",
	[projectFiles(FILES), boardHome("board.md")],
	function* ({ editFile, openDetails, openLivePage, pageMarked, pageReloaded, pageShowing, paragraphElement, detailsState }) {
		yield* openLivePage("/plan.md");
		openDetails(0);
		pageMarked();

		editFile("plan.md", PLAN.replace("A closing line.", "A changed line."));
		yield* pageShowing("A changed line.");

		yield* outcomes({
			"the details block": [detailsState(0), "open"],
			"the intro paragraph": [paragraphElement("Intro."), "the element seen before"],
			"the page": [pageReloaded(), "same page"],
		});
	},
);
