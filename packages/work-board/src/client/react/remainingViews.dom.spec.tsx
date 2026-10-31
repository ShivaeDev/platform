import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const TASK =
	"---\nid: task.fixture\nkind: task\nstatus: draft\nnext_action: Check the proof\ncriteria:\n - id: proof\n   text: Show the result\nattention:\n - id: direction\n   kind: decision\n   reason: Choose a direction\n   state: open\n   response_from: [maintainer]\n   unblocks: [task.fixture]\n---\n# A task\n\nTask context.\n";
const FILES = { "home.md": "# Home", "task.md": TASK };
const URL = "/_board/item/task.fixture/";

screenStory.it(
	"the System page opened by its address shows Codex as not configured",
	[routedScreen(FILES, "/_board/system")],
	function* ({ systemCard }) {
		expect(yield* systemCard("codex")).toEqual(expect.objectContaining({ state: "not-configured" }));
	},
);

screenStory.it(
	"when an outside edit reaches the item page, its text updates while the answer, its focus and its selection stay",
	[routedScreen(FILES, URL, { writable: true })],
	function* ({ answerBoxState, documentText, editFile, refreshDocument, selectInAnswer, writeAnswer }) {
		yield* writeAnswer("Keep my response");
		yield* selectInAnswer(5, 7);
		expect(yield* documentText()).not.toContain("Changed reviewed context");

		yield* editFile("task.md", `${TASK}\nChanged reviewed context.\n`);
		yield* refreshDocument(URL);

		yield* outcomes({
			answer: [answerBoxState(), { focused: true, selection: [5, 7], text: "Keep my response" }],
			document: [documentText(), expect.stringContaining("Changed reviewed context")],
		});
	},
);
