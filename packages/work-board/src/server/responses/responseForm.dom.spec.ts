import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, readerAt, responsesEnabled } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { libraryCount } from "#test/nativeRpc.ts";
import { anAnswerForm } from "#test/storyTraits.ts";

const source = `---
id: question.source
attention:
  - id: review
    kind: review
    state: open
    reason: Which approach?
    response_from: [maintainer]
    unblocks: [question.source]
---
# Investigation

The exact reviewed proposal.
`;

const EXPECTED_LIBRARY_COUNT = 2;

boardStory.it(
	"keeps the same owned form and its draft during initial/live page reads, then exposes a changed revision without discarding input",
	[
		projectFiles({ "item.md": source }, "a project source awaits direction"),
		responsesEnabled(),
		readerAt("/_board/respond?item=question.source&request=review"),
		anAnswerForm(),
	],
	function* ({ board, page, reader, editFile }) {
		reader.input("author", "maintainer");
		const body = reader.input("body", "Keep my conditions.");
		yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
		expect(page.document.querySelector('[name="body"]')).toBe(body);
		editFile("other.md", "# Unrelated source addition");
		yield* Effect.promise(() => waitFor(async () => expect(await Effect.runPromise(libraryCount(board))).toBe(EXPECTED_LIBRARY_COUNT)));
		expect(page.document.querySelector('[name="body"]')).toBe(body);
		expect(body.value).toBe("Keep my conditions.");
		editFile("item.md", source.replace("The exact reviewed proposal.", "Changed reviewed proposal."));
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Source changed")));
		expect(page.document.getElementsByTagName("textarea")[0]?.value).toBe("Keep my conditions.");
		expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
	},
);

boardStory.it(
	"records the previewed response through native commands and shows saved feedback without inferring acceptance",
	[
		projectFiles({ "item.md": source }, "a project source awaits direction"),
		responsesEnabled(),
		readerAt("/_board/respond?item=question.source&request=review"),
		anAnswerForm(),
	],
	function* ({ page, reader }) {
		reader.input("author", "maintainer");
		reader.input("body", "No; use the simpler option.");
		yield* reader.preview();
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false)));
		yield* reader.submit("response-form");
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.getElementById("response-history")?.textContent).toContain("No; use the simpler option.")),
		);
		yield* Effect.promise(() => waitFor(() => expect(reader.responseStatus()).toContain("Saved:")));
		expect(reader.responseStatus()).toContain("not acceptance");
	},
);
