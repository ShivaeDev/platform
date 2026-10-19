import { Effect } from "effect";
import { expect } from "vitest";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { documentRequests } from "#server/document/requests.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { capturedQuestionnaire, questionnaireSource } from "#test/questionnaire.ts";
import { anUnreadableSource } from "#test/storyTraits.ts";
import { questionId, revisionOf } from "./records.ts";

const preview = {
	context: questionnaireSource,
	id: questionId("investigation.choices", "direction", revisionOf(questionnaireSource), "decision.md"),
	item: "investigation.choices",
	reason: "Choose.",
	request: "direction",
	reviewedRevision: revisionOf(questionnaireSource),
	source: "decision.md",
};

for (const { files, unreadable, message } of [
	{ files: {}, message: "Check the source diagnostics and retry", unreadable: true },
	{
		files: { "responses/broken.md": "---\nkind: response\n---\nIncomplete response" },
		message: "Check the source diagnostics and retry",
		unreadable: false,
	},
	{
		files: { "first.md": capturedQuestionnaire(), "second.md": capturedQuestionnaire() },
		message: "Give each recorded question and response a unique ID",
		unreadable: false,
	},
]) {
	boardStory.it(
		"keeps unavailable response history typed with recovery instructions",
		[deferredServing, projectFiles(files), ...(unreadable ? [anUnreadableSource("unreadable.md")] : [])],
		function* ({ readHistory }) {
			const failure = yield* Effect.flip(readHistory(preview));
			expect(failure).toBeInstanceOf(ServiceUnavailable);
			expect(failure.message).toContain(message);
		},
	);
}

boardStory.it(
	"discloses ambiguous document identity to the reader without selecting response history",
	[deferredServing, projectFiles({ "first.md": questionnaireSource, "second.md": questionnaireSource }, "two project sources share one identity")],
	function* ({ readAttention }) {
		const snapshot = yield* readAttention({ "first.md": questionnaireSource, "second.md": questionnaireSource });
		const document = snapshot.documents.at(0);
		expect(document).toBeDefined();
		if (document) {
			expect(documentRequests(document, questionnaireSource, snapshot)).toEqual([
				{
					id: "direction",
					open: false,
					sourceOpen: true,
					title: "Reading experience",
					unavailable: "Item identity is ambiguous; response history is unknown. Give each item a unique ID, then retry.",
				},
			]);
		}
	},
);
