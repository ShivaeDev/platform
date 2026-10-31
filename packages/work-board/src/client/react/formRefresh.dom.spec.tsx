import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const TASK =
	"---\nid: task.fixture\nkind: task\nnext_action: Inspect the proof\nattention:\n - id: direction\n   kind: decision\n   state: open\n   reason: Choose a direction\n   response_from: [maintainer]\n   unblocks: [task.fixture]\n---\n# A task\n\nTask context.\n";
const QUESTION =
	"---\nid: task.fixture\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\noptions:\n - label: Keep files\n   description: Keep direction local\n---\n# Which direction?\n";
const URL = "/_board/item/task.fixture/";
const DRAFT = "Direction in progress";
const CHANGED = "\nChanged source context.\n";

const answerBoxes = [
	{ box: "the answer box on a task's decision", prompt: undefined, source: TASK, underMoreOptions: false },
	{ box: "a question's prompt answer box", prompt: "answer", source: QUESTION, underMoreOptions: false },
	{ box: "a question's own-words box under More options", prompt: undefined, source: QUESTION, underMoreOptions: true },
];

for (const { box, prompt, source, underMoreOptions } of answerBoxes) {
	const files = { "home.md": "# Home", "task.md": source };

	screenStory.it(
		`${box} keeps its draft, focus and backward selection when the page refreshes after an outside edit, and says the source changed`,
		[routedScreen(files, URL, { writable: true })],
		function* ({ answerBoxState, answerStatusLine, editFile, openMoreOptions, refreshQuery, selectInAnswer, writeAnswer }) {
			if (underMoreOptions) {
				yield* openMoreOptions();
			}
			yield* writeAnswer(DRAFT, prompt);
			yield* selectInAnswer(4, 9, prompt);
			expect(yield* answerStatusLine()).not.toContain("Source changed");

			yield* editFile("task.md", `${source}${CHANGED}`);
			yield* refreshQuery("document", { url: URL });

			yield* outcomes({
				draft: [answerBoxState(prompt), { focused: true, selection: [4, 9], text: DRAFT }],
				status: [answerStatusLine(), expect.stringContaining("Source changed")],
			});
		},
	);

	screenStory.it(
		`after a reload ${box} comes back with its draft, focus, selection and source-changed notice${underMoreOptions ? ", with More options open" : ""}`,
		[routedScreen(files, URL, { writable: true })],
		function* ({
			answerBoxState,
			answerStatusLine,
			editFile,
			moreOptionsState,
			openMoreOptions,
			refreshQuery,
			reloadPage,
			selectInAnswer,
			writeAnswer,
		}) {
			if (underMoreOptions) {
				yield* openMoreOptions();
			}
			yield* writeAnswer(DRAFT, prompt);
			yield* selectInAnswer(4, 9, prompt);
			yield* editFile("task.md", `${source}${CHANGED}`);
			yield* refreshQuery("document", { url: URL });

			yield* reloadPage();

			yield* outcomes({
				draft: [answerBoxState(prompt), { focused: true, selection: [4, 9], text: DRAFT }],
				"More options": [moreOptionsState(), underMoreOptions ? "open" : "closed"],
				status: [answerStatusLine(), expect.stringContaining("Source changed")],
			});
		},
	);
}

const HANDOFF_URL = "/_board/handoff?item=task.fixture";
const handoffFiles = { "home.md": "# Home", "task.md": TASK };

screenStory.it(
	"a handoff goal keeps its draft, focus and selection when the handoff page refreshes after an outside edit, and says the source changed",
	[routedScreen(handoffFiles, HANDOFF_URL)],
	function* ({ editFile, fillHandoff, handoffField, handoffStatus, refreshQuery, selectInHandoff }) {
		yield* fillHandoff("Goal", DRAFT);
		yield* selectInHandoff("Goal", 4, 9);
		expect(yield* handoffStatus()).not.toContain("Source changed");

		yield* editFile("task.md", `${TASK}${CHANGED}`);
		yield* refreshQuery("handoff", { url: HANDOFF_URL });

		yield* outcomes({
			goal: [handoffField("Goal"), expect.objectContaining({ focused: true, selection: [4, 9], text: DRAFT })],
			status: [handoffStatus(), expect.stringContaining("Source changed")],
		});
	},
);

screenStory.it(
	"after a reload the handoff goal comes back with its draft, focus, selection and source-changed notice",
	[routedScreen(handoffFiles, HANDOFF_URL)],
	function* ({ editFile, fillHandoff, handoffField, handoffStatus, refreshQuery, reloadPage, selectInHandoff }) {
		yield* fillHandoff("Goal", DRAFT);
		yield* selectInHandoff("Goal", 4, 9);
		yield* editFile("task.md", `${TASK}${CHANGED}`);
		yield* refreshQuery("handoff", { url: HANDOFF_URL });

		yield* reloadPage();

		yield* outcomes({
			goal: [handoffField("Goal"), expect.objectContaining({ focused: true, selection: [4, 9], text: DRAFT })],
			status: [handoffStatus(), expect.stringContaining("Source changed")],
		});
	},
);
