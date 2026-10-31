import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveForm } from "#test/answerTraits.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const DRAFT = "Direction before the page was restored";

screenStory.it(
	"after the browser restores the item page from its page cache, the answer draft is still there and Record answer saves it as an answer, not acceptance",
	[liveForm("response")],
	function* ({ answerBoxState, answerStatusLine, readSessionFiles, recordAnswer, restoreSession, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		yield* restoreSession();
		expect(yield* answerBoxState()).toEqual(expect.objectContaining({ text: DRAFT }));

		yield* recordAnswer();

		yield* outcomes({
			saved: [readSessionFiles("responses"), [expect.stringContaining("item: item.edge"), expect.stringContaining(DRAFT)]],
			status: [answerStatusLine(), expect.stringMatching(/Answer saved\..*not acceptance/su)],
		});
	},
);

screenStory.it(
	"after the browser restores the handoff page from its page cache, the handoff draft is still there and Prepare handoff saves it",
	[liveForm("handoff")],
	function* ({ fillHandoff, handoffField, handoffStatus, pressPrepareHandoff, readSessionFiles, restoreSession }) {
		yield* fillHandoff("Agent name", "local-reviewer");
		yield* fillHandoff("Goal", DRAFT);
		yield* restoreSession();
		expect(yield* handoffField("Goal")).toEqual(expect.objectContaining({ text: DRAFT }));

		yield* pressPrepareHandoff();

		yield* outcomes({
			saved: [readSessionFiles("handoffs"), [expect.stringContaining(DRAFT)]],
			status: [handoffStatus(), expect.stringContaining("Saved handoffs/")],
		});
	},
);
