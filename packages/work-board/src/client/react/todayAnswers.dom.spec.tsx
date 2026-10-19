import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { recentAnswersFixture, sharedHeadingFixture } from "#test/responseRecords.ts";
import { unreadableHome } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen, routedScreen } from "#test/screenTraits.ts";
import { screenFiles } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const ROWS = "ul[aria-label='Answered'] > li";
const STORAGE = "Where should the project documents live?";
const OPTIONS = `[aria-label='Options for ${STORAGE}'] button:not([data-slot='collapsible-trigger'])`;

screenStory.it(
	"keeps the question just answered on Today at inbox zero and says when its agent acts",
	[routedScreen({ "home.md": "# Release plans\n", "question.md": inboxQuestion }, "/", { home: "home.md", writable: true })],
	function* ({ activate, answeredRows, click, editFile, findElement, readText, refreshInbox }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-attention-id='question.storage'] button")).not.toBeNull()));
		click("[data-attention-id='question.storage'] button[aria-haspopup='dialog']");
		yield* Effect.promise(() => eventually(() => expect(findElement(OPTIONS, document)).not.toBeNull()));
		yield* Effect.promise(() => activate(OPTIONS));
		yield* Effect.promise(() =>
			eventually(() => expect(answeredRows()).toEqual([[STORAGE, "You answered: Keep local files. Waiting on the agent."]])),
		);
		expect(readText('#needs-you [data-slot="empty-title"]')).toBe("Nothing needs you");
		expect(findElement("#needs-you a[href='/_board/start']")).toBeNull();
		expect(readText(`${ROWS} time`)).toBe("just now");
		editFile("question.md", inboxQuestion.replace("status: open", "status: done"));
		yield* Effect.promise(refreshInbox);
		yield* Effect.promise(() => eventually(() => expect(answeredRows()).toEqual([[STORAGE, "You answered: Keep local files. It's closed now."]])));
		editFile("question.md", `${inboxQuestion}\nThe shared drive is gone.\n`);
		yield* Effect.promise(refreshInbox);
		yield* Effect.promise(() =>
			eventually(() =>
				expect(answeredRows()).toEqual([[STORAGE, "You answered: Keep local files. The question changed after the answer, so it asks again."]]),
			),
		);
		expect(findElement("[data-attention-id='question.storage']")).not.toBeNull();
	},
);

screenStory.it(
	"lists every answer still waiting on its agent and only the reader's own acted-on answers from the last week",
	[routedScreen(recentAnswersFixture(Effect.runSync(Clock.currentTimeMillis)), "/", { home: "home.md" })],
	function* ({ answeredRows }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(answeredRows()).toEqual([
					["Ship the guide this week?", "You answered: Yes. It's closed now."],
					["Drop the old flag?", "Answered by reviewer: Yes. Waiting on the agent."],
					["Keep the release branch?", "You answered: Yes. Waiting on the agent."],
				]),
			),
		);
	},
);

for (const [workspace, files, guide] of [
	["holds no identified documents", { "notes.md": "# Notes\n" }, true],
	["holds identified work", { "task.md": "---\nid: task.done\nkind: task\nstatus: done\n---\n# Finished task\n" }, false],
] as const) {
	screenStory.it(
		`offers Getting started at inbox zero only when the workspace ${workspace}`,
		[routedScreen(files, "/")],
		function* ({ findElement, readText }) {
			yield* Effect.promise(() => eventually(() => expect(readText('#needs-you [data-slot="empty-title"]')).toBe("Nothing needs you")));
			expect(findElement("#needs-you a[href='/_board/start']") !== null).toBe(guide);
		},
	);
}

screenStory.it(
	"names the home document after its own title and keeps Workspace for the Board as a whole",
	[routedScreen({ "home.md": "# Release plans\n" }, "/", { home: "home.md" })],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText(".today-page a[href='/home.md']")).toBe("Release plans")));
		expect(readText("#doc")).not.toContain("Workspace notes");
		expect(readText("nav[aria-label='File location'] a[href='/']")).toBe("Workspace");
		expect(findElement("nav[aria-label='File location'] a[href='/home.md']")).toBeNull();
	},
);

screenStory.it(
	"says in plain words that what needs you is unknown while a workspace file cannot be read",
	[screenFiles({ "home.md": "# Release plans\n", "question.md": inboxQuestion }, { home: "home.md" }), unreadableHome(), openScreen()],
	function* ({ readText }) {
		yield* Effect.promise(() =>
			eventually(() => expect(readText("#needs-you > p[role='status']")).toBe("Some files couldn't be read, so what needs you is unknown.")),
		);
	},
);

screenStory.it(
	"lists no answers while a workspace file cannot be read",
	[screenFiles(recentAnswersFixture(Effect.runSync(Clock.currentTimeMillis)), { home: "home.md" }), unreadableHome(), openScreen()],
	function* ({ answeredRows, readText }) {
		yield* Effect.promise(() =>
			eventually(() => expect(readText("#needs-you > p[role='status']")).toBe("Some files couldn't be read, so what needs you is unknown.")),
		);
		expect(answeredRows()).toEqual([]);
	},
);

screenStory.it(
	"names each answer by its own question and tells apart questions that share a heading",
	[routedScreen(sharedHeadingFixture(Effect.runSync(Clock.currentTimeMillis)), "/", { home: "home.md" })],
	function* ({ answeredRows }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(answeredRows()).toEqual([
					["How should we proceed? · The release notes are missing", "You answered: Retry. Waiting on the agent."],
					["How should we proceed? · The PR changed after review", "You answered: Retry. Waiting on the agent."],
				]),
			),
		);
	},
);
