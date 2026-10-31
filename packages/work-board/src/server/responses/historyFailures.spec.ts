import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { capturedQuestionnaire, questionnaireSource } from "#test/questionnaire.ts";
import { anUnreadableSource } from "#test/storyTraits.ts";

const INCOMPLETE = "unavailable: Response history is incomplete or malformed. Check the source diagnostics and retry.";

boardStory.it(
	"reply history is unavailable while a project source cannot be read",
	[deferredServing, anUnreadableSource("unreadable.md")],
	function* ({ historyBeforeServing }) {
		expect(yield* historyBeforeServing()).toBe(INCOMPLETE);
	},
);

boardStory.it(
	"reply history is unavailable while a recorded reply is incomplete",
	[deferredServing, projectFiles({ "responses/broken.md": "---\nresponse: {}\n---\nIncomplete response" }, "a reply record has no fields")],
	function* ({ historyBeforeServing }) {
		expect(yield* historyBeforeServing()).toBe(INCOMPLETE);
	},
);

boardStory.it(
	"reply history is unavailable while two captured questions share one identity",
	[
		deferredServing,
		projectFiles({ "first.md": capturedQuestionnaire(), "second.md": capturedQuestionnaire() }, "two captured questions share one identity"),
	],
	function* ({ historyBeforeServing }) {
		expect(yield* historyBeforeServing()).toBe(
			"unavailable: Response history includes ambiguous identities. Give each recorded question and response a unique ID, then retry.",
		);
	},
);

boardStory.it(
	"an item whose identity two sources share shows its request without reply history",
	[projectFiles({ "first.md": questionnaireSource, "second.md": questionnaireSource }, "two project sources share one identity")],
	function* ({ documentRequests }) {
		expect(yield* documentRequests("first.md")).toEqual([
			{
				id: "direction",
				open: false,
				unavailable: "Item identity is ambiguous; response history is unknown. Give each item a unique ID, then retry.",
			},
		]);
	},
);
