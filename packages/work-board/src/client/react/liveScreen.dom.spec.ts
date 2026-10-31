import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { BOARD, FILES } from "#test/live.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, routedScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"counts the new task on the board and the new file in the Library once the Board refreshes after outside edits",
	[routedScreen({ ...FILES }, "/board.md", { home: "board.md" })],
	function* ({ boardTaskCount, editFile, navigationSummary, refreshBoardPage }) {
		yield* editFile("board.md", `${BOARD}\n### \`ops\` Rotate the key\n`);
		yield* editFile("later/idea.md", "# Idea\n");
		expect(yield* boardTaskCount()).toBe("1 to do");

		yield* refreshBoardPage("/board.md");

		yield* outcomes([
			["the board", () => boardTaskCount(), "2 to do"],
			["the Library count", () => navigationSummary(), expect.objectContaining({ libraryCount: Object.keys(FILES).length + 1 })],
		]);
	},
);

const rememberedAuthor = [
	screenWorkspace("remembered-author"),
	storedScreenState({ "work-board:author:remembered-author": "Casey" }),
	chromeScreen(
		{ "home.md": "# Home", "other.md": inboxQuestion.replace("question.storage", "question.backup"), "question.md": inboxQuestion },
		"/question.md",
		{ writable: true },
	),
];

screenStory.it(
	"asks only for the answer up front, folds the reply type under details and neither asks for nor shows the remembered author",
	rememberedAuthor,
	function* ({ answerForm, pageText }) {
		yield* outcomes([
			[
				"the form",
				() => answerForm(),
				{
					author: "not asked",
					details: "closed",
					item: "question.storage",
					promptsShown: ["answer"],
					supersedes: "not asked",
					type: "under details",
				},
			],
			["the page", () => pageText(), expect.not.stringContaining("Casey")],
		]);
	},
);

screenStory.it(
	"records an answer on another question under the remembered author",
	rememberedAuthor,
	function* ({ answerSaveStatus, chooseAnswerOption, navigate, savedAnswerAuthors, submitAnswer }) {
		yield* navigate("/other.md");
		yield* chooseAnswerOption("option-1");
		expect(yield* answerSaveStatus()).toBe("");

		yield* submitAnswer();

		yield* outcomes([
			["the authors", () => savedAnswerAuthors("question.backup", "answer"), ["Casey"]],
			["the status", () => answerSaveStatus(), expect.stringContaining("Answer saved")],
		]);
	},
);

screenStory.it(
	"restores a handoff draft when the reader comes back to it",
	[
		screenWorkspace("handoff-navigation"),
		chromeScreen(
			{ "home.md": "# Home", "item.md": "---\nid: task.focus\nkind: task\n---\n# Focus\n\nReviewed source.\n" },
			"/_board/handoff?item=task.focus",
		),
	],
	function* ({ back, handoffText, mainHeading, navigate, writeInHandoff }) {
		yield* writeInHandoff("Agent name", "agent-local");
		yield* writeInHandoff("Goal", "Retain direction across navigation");
		yield* navigate("/item.md");
		expect(yield* mainHeading()).toBe("Focus");

		yield* back();

		expect(yield* handoffText("Goal")).toBe("Retain direction across navigation");
	},
);
