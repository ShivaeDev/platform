import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { answerCardFixture, decisionId, TEXT_QUESTION_ID, textQuestionFixture } from "#test/answerCardFixture.ts";
import { answeredDecisionFixture } from "#test/answeredDecisionFixture.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const questionUrl = `/_board/item/${TEXT_QUESTION_ID}/`;
const DRAFT = "Share one pool per worker.\n\nCap it at ten connections.";
const closedQuestion = { ...textQuestionFixture, "question.md": textQuestionFixture["question.md"].replace("status: open", "status: done") };

screenStory.it(
	"keeps an unsent draft readable and copyable when its question closes while the reader writes",
	[screenWorkspace("closed-draft"), routedScreen({ ...textQuestionFixture }, questionUrl, { home: "home.md", writable: true })],
	function* ({ answerInput, click, editFile, findElement, readText, refreshDocument }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		answerInput("body", DRAFT);
		editFile("question.md", closedQuestion["question.md"]);
		yield* Effect.promise(() => refreshDocument(questionUrl));
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-closed-draft]")).not.toBeNull()));
		expect(findElement("#response-form")).toBeNull();
		expect(readText("[data-closed-draft] h2")).toBe("Closed while you were writing: Pooling design for the scale tests");
		expect(readText("[data-closed-draft] p[role='status']:not([data-copy-status])")).toBe(
			"Its file now marks the question done. Your draft was not sent.",
		);
		const draft = findElement<HTMLTextAreaElement>("[data-closed-draft] textarea");
		expect(draft?.readOnly).toBe(true);
		expect(draft?.value).toBe(DRAFT);
		click("[data-closed-draft] button");
		yield* Effect.promise(() => eventually(() => expect(readText("[data-closed-draft] [data-copy-status]")).toBe("Copied.")));
		expect(yield* Effect.promise(() => navigator.clipboard.readText())).toBe(DRAFT);
	},
);

screenStory.it(
	"lets an untouched answer card go quietly when its question closes",
	[screenWorkspace("closed-untouched"), routedScreen({ ...textQuestionFixture }, questionUrl, { home: "home.md", writable: true })],
	function* ({ editFile, findElement, refreshDocument }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		editFile("question.md", closedQuestion["question.md"]);
		yield* Effect.promise(() => refreshDocument(questionUrl));
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).toBeNull()));
		expect(findElement("[data-closed-draft]")).toBeNull();
	},
);

screenStory.it(
	"shows a question's own text above its answer box and lets the box grow with the answer",
	[screenWorkspace("question-order"), routedScreen({ ...textQuestionFixture }, questionUrl, { home: "home.md", writable: true })],
	function* ({ findElement }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		const context = findElement("article.doc");
		const box = findElement<HTMLTextAreaElement>('#response-form [name="body"]');
		expect(context?.textContent).toContain("Write the design in your answer");
		expect(context?.compareDocumentPosition(box ?? document.body)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(findElement(".item-introduction")?.nextElementSibling?.classList.contains("answer-cards")).toBe(false);
		expect([...(box?.classList ?? [])]).toEqual(expect.arrayContaining(["field-sizing-content", "min-h-32", "max-h-[60vh]"]));
	},
);

screenStory.it(
	"puts focus on the first option when a Today ask opens a choice question",
	[screenWorkspace("arrival-choice"), routedScreen(answerCardFixture, "/", { home: "home.md", writable: true })],
	function* ({ click, findElement, location, readFocus }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-attention-row] a[title]")).not.toBeNull()));
		click("[data-attention-row] a[title]");
		yield* Effect.promise(() => eventually(() => expect(location()?.pathname).toBe(`/_board/item/${decisionId}/`)));
		yield* Effect.promise(() => eventually(() => expect(readFocus()).toBe(findElement("[data-choice='option-1']"))));
	},
);

screenStory.it(
	"puts focus in the answer box when an Answer link opens a written question",
	[screenWorkspace("arrival-text"), routedScreen({ ...textQuestionFixture }, "/", { home: "home.md", writable: true })],
	function* ({ findElement, follow, readFocus }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-attention-row]")).not.toBeNull()));
		yield* Effect.promise(() => follow(`${questionUrl}#answer-card-answer`));
		yield* Effect.promise(() => eventually(() => expect(readFocus()).toBe(findElement('#response-form [name="body"]'))));
	},
);

screenStory.it(
	"keeps focus where the reader writes when they follow the Answer link again",
	[screenWorkspace("arrival-keep"), routedScreen(answerCardFixture, `/_board/item/${decisionId}/`, { home: "home.md", writable: true })],
	function* ({ findElement, focus, follow, readFocus }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form [data-choice='option-1']")).not.toBeNull()));
		const box = findElement<HTMLTextAreaElement>('#response-form [name="body"]');
		focus(box);
		yield* Effect.promise(() => follow(`/_board/item/${decisionId}/#answer-card-direction`));
		yield* Effect.promise(() => eventually(() => expect(findElement("#answer-card-direction")?.style.scrollMarginTop).not.toBe("")));
		expect(readFocus()).toBe(box);
	},
);

screenStory.it(
	"says More options in plain words without the author label",
	[screenWorkspace("plain-options"), routedScreen(answeredDecisionFixture(), `/_board/item/${decisionId}/`, { home: "home.md", writable: true })],
	function* ({ findElement, openDetails, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-answered]")).not.toBeNull()));
		openDetails("details[data-key='change-answer']");
		openDetails("details[data-key='response-details']");
		const more = readText("details[data-key='response-details']");
		for (const internal of ["author label", "maintainer", "Response kind", "Supersedes", "supersede", "KiB", "responses/"]) {
			expect(more).not.toContain(internal);
		}
		expect(findElement('[name="author"]')).toBeNull();
		expect(more).toContain("This browser keeps your draft for seven days after your last edit.");
		expect(findElement("[name='type']")?.closest(".grid")?.textContent).toContain("Kind of replyAn answer (no is an answer too)");
		expect(findElement("[name='supersedes']")?.closest(".grid")?.textContent).toContain(
			"Replace an earlier answer?Yes, replace your answer: Request changes",
		);
	},
);
