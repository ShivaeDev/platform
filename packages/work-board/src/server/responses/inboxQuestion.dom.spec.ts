import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, readerAt, responsesEnabled } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { anAnswerForm, anOpenQuestion, aRememberedAuthor } from "#test/storyTraits.ts";

boardStory.it(
	"records a recommended option from the item page and updates the live Inbox badge",
	[anOpenQuestion(), responsesEnabled(), readerAt("/_board/item/question.storage/"), anAnswerForm(), aRememberedAuthor("Casey")],
	function* ({ page, reader, savedAnswer }) {
		yield* reader.chooseOption("option-1");
		expect(page.document.querySelector('[data-choice="option-1"]')?.getAttribute("aria-checked")).toBe("true");
		yield* reader.submit();
		yield* Effect.promise(() => waitFor(() => expect(reader.responseStatus()).toContain("Saved:")));
		yield* Effect.promise(() => waitFor(() => expect(reader.inboxCounts()).toEqual(["0", "0"])));
		const response = savedAnswer();
		expect(response.fields.kind).toBe("response");
		expect(response.fields.response?.answers?.[0]?.selected).toEqual(["option-1"]);
		expect(response.body).toContain("Keep local files");
	},
);
