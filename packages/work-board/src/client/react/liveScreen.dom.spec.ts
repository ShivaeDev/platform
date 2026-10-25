import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { BOARD, FILES } from "#test/live.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen, routedScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
screenStory.it(
	"refreshes board task counts and the shell's library count after outside edits",
	[routedScreen({ ...FILES }, "/board.md", { home: "board.md" })],
	function* ({ readText, editFile, refreshQuery, refreshDocument, readNavigation }) {
		yield* Effect.promise(() => eventually(() => expect(readText(".counts")).toBe("1 to do")));
		editFile("board.md", `${BOARD}\n### \`ops\` Rotate the key\n`);
		editFile("later/idea.md", "# Idea\n");
		yield* Effect.promise(() => refreshQuery("board", { url: "/board.md" }));
		yield* Effect.promise(() => refreshDocument());
		yield* Effect.promise(() => eventually(() => expect(readText(".counts")).toBe("2 to do")));
		expect((yield* Effect.promise(() => readNavigation())).counts.library).toBe(Object.keys(FILES).length + 1);
	},
);

screenStory.it(
	"records answers under the remembered author without showing it and keeps reply options under More",
	[
		screenWorkspace("remembered-author"),
		storedScreenState({ "work-board:author:remembered-author": "Casey" }),
		chromeScreen(
			{ "home.md": "# Home", "other.md": inboxQuestion.replace("question.storage", "question.backup"), "question.md": inboxQuestion },
			"/question.md",
			{ writable: true },
		),
	],
	function* ({ click, findElement, findElements, navigate, readResponses, readText, responseClick }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		expect(findElement('[data-key="response-details"]')).toHaveProperty("open", false);
		expect(
			findElements("#response-form textarea")
				.filter((field) => !field.closest("details"))
				.map((field) => field.closest("[data-prompt]")?.getAttribute("data-prompt")),
		).toEqual(["answer"]);
		expect(findElement('[name="type"]')?.closest("details")?.getAttribute("data-key")).toBe("response-details");
		expect(findElement('[name="author"]')).toBeNull();
		expect(findElement('[name="supersedes"]')).toBeNull();
		expect(readText("#response-form")).not.toContain("Casey");
		yield* Effect.promise(() => navigate("/other.md"));
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")?.getAttribute("data-item")).toBe("question.backup")));
		click("[data-choice='option-1']");
		yield* Effect.promise(async () => responseClick("submit"));
		yield* Effect.promise(() => eventually(() => expect(readText("#response-status")).toContain("Answer saved")));
		const saved = yield* Effect.promise(() => readResponses("question.backup", "answer"));
		expect(saved.responses.map((entry) => entry.response.author)).toEqual(["Casey"]);
	},
);

screenStory.it(
	"restores a handoff draft after navigating away and back",
	[
		screenWorkspace("handoff-navigation"),
		chromeScreen(
			{ "home.md": "# Home", "item.md": "---\nid: task.focus\nkind: task\n---\n# Focus\n\nReviewed source.\n" },
			"/_board/handoff?item=task.focus",
		),
	],
	function* ({ input, navigate, back, findElement }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#handoff-form")).not.toBeNull()));
		input('[name="recipient"]', "agent-local");
		input('[name="goal"]', "Retain direction across navigation");
		yield* Effect.promise(() => navigate("/item.md"));
		yield* Effect.promise(() => back());
		yield* Effect.promise(() => eventually(() => expect(findElement('[name="goal"]')).toHaveProperty("value", "Retain direction across navigation")));
	},
);
