import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import {
	answerCardFixture,
	DECISION_REASON,
	decisionFile,
	decisionId,
	paragraphDecisionFixture,
	readyDecisionFixture,
} from "#test/answerCardFixture.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";
import { WIDE_TABLE, WIDE_TABLE_LAYOUT } from "#test/wideTableFixture.ts";

expectNoReactWarnings();
const url = `/_board/item/${decisionId}/`;

for (const mode of ["fenced", "nested", "paragraphs"]) {
	const files = { ...(mode === "paragraphs" ? paragraphDecisionFixture : answerCardFixture) };
	if (mode === "nested") {
		const source = files[decisionFile];
		if (source === undefined) {
			throw new Error("Missing decision fixture");
		}
		files[decisionFile] = source.replace(DECISION_REASON, `~~~~\n${DECISION_REASON}\n~~~~`);
	}
	screenStory.it(
		`renders a managed decision with a ${mode} reason once below its header and is titled after the unblocked item`,
		[screenWorkspace("answer-card-fixture"), routedScreen(files, url, { home: "home.md", writable: true })],
		function* ({ findElement, readAttribute, readText, findElements }) {
			yield* eventually(() => expect(findElement("#response-form")).not.toBeNull());
			expect(findElement('[name="author"]')).toBeNull();
			const header = findElement(".item-introduction");
			expect(readText("h1", header)).toBe("Fleet decision: Publish the install guide");
			expect(readText('[aria-label="File location"]')).toContain("Fleet decision: Publish the install guide");
			expect(readText('[aria-label="File location"]')).not.toContain(decisionId);
			expect(header?.nextElementSibling?.classList.contains("answer-cards")).toBe(true);
			expect(readText("#answer-title-direction")).toBe("Answer: Publish the install guide");
			expect(readText(".answer-reason strong")).toBe("Which publishing path should we take?");
			expect(readAttribute(".answer-reason a", "href")).toBe("https://example.com/releases");
			expect(readText("article.doc")).not.toContain("Which publishing path");
			if (mode === "paragraphs") {
				expect(readText("article.doc")).toContain("Preserve this background before the decision.");
				expect(readText("article.doc")).toContain("Preserve this conclusion after the decision.");
				expect(readText("article.doc")).not.toContain("Read the release guide.");
				expect(findElements(".answer-reason p").map((p) => p.textContent)).toEqual([
					"Which publishing path should we take?",
					"Read the release guide.",
				]);
			}
			expect([...findElements(".question-choice")].map((button) => button.textContent)).toEqual([
				"Publish nowRecommendedShip the reviewed guide with this release.",
				"Wait for reviewKeep the work blocked until another review.",
			]);
			expect(readText(".item-summary")).not.toContain(decisionId);
			expect(readText("[data-document-source] pre")).toBe(`${files[decisionFile]?.split("\n---\n")[0]}\n---\n`);
			expect([...findElements("h1,h2,[title]")].every((element) => !/[a-f\d]{64}/u.test(element.textContent ?? ""))).toBe(true);
		},
	);
}

screenStory.it(
	"retains an option and free text through a document query refresh and records through the existing response action",
	[
		screenWorkspace("answer-card-fixture"),
		storedScreenState({ "work-board:author:answer-card-fixture": "Reviewer" }),
		routedScreen({ ...answerCardFixture }, url, { home: "home.md", writable: true }),
	],
	function* ({ refreshDocument, selectText, readResponses, click, answerPrompt, responseClick, findElement, readAttribute, readFocus, readText }) {
		yield* eventually(() => expect(findElement(".question-choice")).not.toBeNull());
		click(".question-choice label");
		const input = answerPrompt("answer", "Use the reviewed version.");
		selectText(input, 4, 7);
		yield* Effect.promise(() => refreshDocument(url));
		yield* eventually(() => expect(readAttribute("[data-choice='option-1']", "aria-checked")).toBe("true"));
		expect(answerPrompt("answer")).toBe(input);
		expect(input.value).toBe("Use the reviewed version.");
		expect(readFocus()).toBe(input);
		expect([input.selectionStart, input.selectionEnd]).toEqual([4, 7]);
		yield* Effect.promise(async () => responseClick("submit"));
		yield* eventually(() =>
			expect(readText("[data-answered]")).toBe("Answered by Reviewer: Publish now. Fleet isn't running. It picks this up when it starts again."),
		);
		const saved = yield* Effect.promise(() => readResponses(decisionId, "direction"));
		expect(saved.responses).toMatchObject([
			{
				response: {
					answers: [{ prompt: "answer", selected: ["option-1"], text: "Use the reviewed version." }],
					author: "Reviewer",
				},
			},
		]);
	},
);

screenStory.it(
	"opens a Today ask on a read-only Board directly on the item and focuses its answer card",
	[screenWorkspace("answer-card-fixture"), routedScreen(answerCardFixture, "/")],
	function* ({ click, findElement, readFocus, location }) {
		yield* eventually(() => expect(findElement("[data-attention-row] a[title]")).not.toBeNull());
		const link = findElement<HTMLAnchorElement>("[data-attention-row] a[title]");
		expect(link?.getAttribute("href")).toBe(`${url}#answer-card-direction`);
		click(link);
		yield* eventually(() => expect(location()?.pathname).toBe(url));
		expect(location()?.hash).toBe("answer-card-direction");
		yield* eventually(() => expect(readFocus()?.id).toBe("answer-card-direction"));
	},
);

screenStory.it(
	"labels a malformed open question unavailable while retaining its source status",
	[
		screenWorkspace("answer-card-fixture"),
		routedScreen(
			{
				"home.md": "# Home",
				"question.md":
					"---\nid: question.invalid\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\noptions:\n - label: ''\n   description: Invalid choice\n---\n# Choose a direction\n",
			},
			"/_board/item/question.invalid/",
		),
	],
	function* ({ readText }) {
		yield* eventually(() => expect(readText(".response-panel h2")).toBe("Answer unavailable"));
		expect(readText(".response-panel")).not.toContain("Question closed");
		expect(readText(".item-summary")).toContain("Needs you");
	},
);

screenStory.it(
	"puts the recommendation and primary PR action above secondary human choices",
	[screenWorkspace("answer-card-fixture"), routedScreen(readyDecisionFixture, url, { home: "home.md", writable: true })],
	function* ({ findElement, readText, findElements, readAttribute }) {
		yield* eventually(() => expect(findElement("#response-form")).not.toBeNull());
		const card = findElement(".response-panel");
		expect(readText(".answer-recommendation", card)).toBe("Merge the reviewed PR on GitHub.");
		const link = findElement(".answer-links a", card);
		expect(link?.textContent).toBe("Open PR #395");
		expect(link?.getAttribute("href")).toBe("https://github.com/ShivaeDev/platform/pull/395");
		expect(link?.classList.contains("bg-primary")).toBe(true);
		expect(link?.compareDocumentPosition(findElement("fieldset", card) ?? document.body)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect([...(findElements(".question-choice strong", card) ?? [])].map((label) => label.textContent)).toEqual([
			"Request changes",
			"Stop and hand back",
		]);
		expect(readText(".item-summary")).not.toContain("Not recorded");
		expect(readAttribute(".item-summary [data-status-token]", "data-status-token")).toBe("needs-you");
		expect(readText("article.doc")).not.toContain("Publish the reviewed guide");
	},
);

for (const heading of ["### Release ownership", ""]) {
	const files = { ...readyDecisionFixture, [decisionFile]: (readyDecisionFixture[decisionFile] ?? "").replace("### Stop and hand back", heading) };
	screenStory.it(
		`uses an option heading or capitalised id: ${heading}`,
		[screenWorkspace("answer-card-fixture"), routedScreen(files, url, { home: "home.md", writable: true })],
		function* ({ findElements }) {
			yield* eventually(() =>
				expect(findElements(".question-choice strong").map((label) => label.textContent)).toEqual([
					"Request changes",
					heading ? "Release ownership" : "Release",
				]),
			);
		},
	);
}

const files = { ...readyDecisionFixture, [decisionFile]: (readyDecisionFixture[decisionFile] ?? "").replace('select="one"', 'select="many"') };
screenStory.it(
	"toggles option checkboxes when several choices are allowed",
	[screenWorkspace("answer-card-fixture"), routedScreen(files, url, { home: "home.md", writable: true })],
	function* ({ click, findElement, readAttribute }) {
		yield* eventually(() => expect(findElement(".question-choice")).not.toBeNull());
		expect(findElement("[role='radio']")).toBeNull();
		click(".question-choice label");
		expect(readAttribute("[data-choice='retry']", "role")).toBe("checkbox");
		expect(readAttribute("[data-choice='retry']", "aria-checked")).toBe("true");
		click(".question-choice label");
		expect(readAttribute("[data-choice='retry']", "aria-checked")).toBe("false");
	},
);

screenStory.it(
	"moves a single answer with arrow keys from one tab stop and records the chosen option",
	[screenWorkspace("answer-keyboard"), routedScreen(readyDecisionFixture, url, { home: "home.md", writable: true })],
	function* ({ findElement, focus, press, readAttribute, readFocus, readResponses, readText, responseClick }) {
		yield* eventually(() => expect(findElement("[role='radiogroup']")).not.toBeNull());
		expect(readAttribute("[role='radiogroup']", "aria-labelledby")).toBe(findElement("fieldset legend")?.id);
		expect([readAttribute("[data-choice='retry']", "tabindex"), readAttribute("[data-choice='release']", "tabindex")]).toEqual(["0", "-1"]);
		focus("[data-choice='retry']");
		yield* Effect.promise(() => press("ArrowDown"));
		expect(readFocus()).toBe(findElement("[data-choice='release']"));
		expect(readAttribute("[data-choice='release']", "aria-checked")).toBe("true");
		expect(readAttribute("[data-choice='retry']", "aria-checked")).toBe("false");
		yield* Effect.promise(() => press("ArrowUp"));
		yield* Effect.promise(() => press("ArrowUp"));
		expect(readFocus()).toBe(findElement("[data-choice='release']"));
		expect(readAttribute("[data-choice='release']", "aria-checked")).toBe("true");
		yield* Effect.promise(async () => responseClick("submit"));
		yield* eventually(() => expect(readText("[data-answered]")).toContain("Stop and hand back"));
		const saved = yield* Effect.promise(() => readResponses(decisionId, "direction"));
		expect(saved.responses.map((entry) => entry.response.answers)).toEqual([[{ prompt: "fleet-action", selected: ["release"], text: "" }]]);
	},
);

screenStory.it(
	"toggles several answers with Space and records them in the order they were chosen",
	[screenWorkspace("answer-keyboard-many"), routedScreen(files, url, { home: "home.md", writable: true })],
	function* ({ findElement, focus, press, readAttribute, readResponses, readText, responseClick }) {
		yield* eventually(() => expect(findElement("[data-choice='retry']")).not.toBeNull());
		expect([readAttribute("[data-choice='retry']", "tabindex"), readAttribute("[data-choice='release']", "tabindex")]).toEqual(["0", "0"]);
		focus("[data-choice='release']");
		yield* Effect.promise(() => press(" "));
		focus("[data-choice='retry']");
		yield* Effect.promise(() => press(" "));
		expect([readAttribute("[data-choice='retry']", "aria-checked"), readAttribute("[data-choice='release']", "aria-checked")]).toEqual([
			"true",
			"true",
		]);
		yield* Effect.promise(() => press(" "));
		yield* Effect.promise(() => press(" "));
		yield* Effect.promise(async () => responseClick("submit"));
		yield* eventually(() => expect(readText("[data-answered]")).toContain("Stop and hand back"));
		const saved = yield* Effect.promise(() => readResponses(decisionId, "direction"));
		expect(saved.responses.map((entry) => entry.response.answers)).toEqual([[{ prompt: "fleet-action", selected: ["release", "retry"], text: "" }]]);
	},
);

const tableRecommendation = Object.fromEntries(
	Object.entries(answerCardFixture).map(([file, source]) => [
		file,
		file === decisionFile ? source.replace("**Publish** the reviewed guide.", `**Publish** the reviewed guide.\n\n${WIDE_TABLE}`) : source,
	]),
);
screenStory.it(
	"lays out a wide table in an answer card like a document table, scrolling inside its own box",
	[screenWorkspace("answer-card-table"), routedScreen(tableRecommendation, url, { home: "home.md", writable: true })],
	function* ({ findElement, readTableLayout }) {
		yield* eventually(() => expect(findElement(".answer-recommendation table")).not.toBeNull());
		expect(readTableLayout(".answer-recommendation table")).toEqual(WIDE_TABLE_LAYOUT);
	},
);
