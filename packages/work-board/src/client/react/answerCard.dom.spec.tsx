import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
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
		`renders a managed decision with a ${mode} reason once below its header and uses the unblocked item's title`,
		[screenWorkspace("answer-card-fixture"), routedScreen(files, url)],
		function* ({ findElement, readAttribute, readText, findElements }) {
			yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
			expect(readAttribute('[name="author"]', "aria-invalid")).toBe("false");
			expect(readText(".response-panel")).not.toContain("Add your local author label.");
			const header = findElement(".item-introduction");
			expect(readText("h1", header)).toBe("Publish the install guide");
			expect(readText('[aria-label="File location"]')).toContain("Publish the install guide");
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
				expect(findElements(".answer-reason p")).toHaveLength(2);
			}
			expect([...findElements(".question-choice")].map((button) => button.textContent)).toEqual([
				"Publish nowRecommendedShip the reviewed guide with this release.",
				"Wait for reviewKeep the work blocked until another review.",
			]);
			expect(readText(".item-summary")).not.toContain(decisionId);
			expect(readText('[aria-label="Document source"] pre')?.split(decisionId)).toHaveLength(2);
			expect([...findElements("h1,h2,[title]")].every((element) => !/[a-f\d]{64}/u.test(element.textContent ?? ""))).toBe(true);
		},
	);
}

screenStory.it(
	"retains an option and free text through a document query refresh and records through the existing response action",
	[screenWorkspace("answer-card-fixture"), routedScreen({ ...answerCardFixture }, url, { home: "home.md", writable: true })],
	function* ({
		refreshDocument,
		selectText,
		readResponses,
		answerInput,
		click,
		answerPrompt,
		responseClick,
		findElement,
		readAttribute,
		readFocus,
		readText,
	}) {
		yield* Effect.promise(() => eventually(() => expect(findElement(".question-choice")).not.toBeNull()));
		answerInput("author", "Reviewer");
		click(findElement<HTMLButtonElement>(".question-choice"));
		const input = answerPrompt("answer", "Use the reviewed version.");
		selectText(input, 4, 7);
		yield* Effect.promise(() => refreshDocument(url));
		yield* Effect.promise(() => eventually(() => expect(readAttribute(".question-choice", "aria-pressed")).toBe("true")));
		expect(answerPrompt("answer")).toBe(input);
		expect(input.value).toBe("Use the reviewed version.");
		expect(readFocus()).toBe(input);
		expect([input.selectionStart, input.selectionEnd]).toEqual([4, 7]);
		yield* Effect.promise(async () => responseClick("submit"));
		yield* Effect.promise(() =>
			eventually(() =>
				expect(readText("[data-answered]")).toBe("Reviewer answered: Publish now. Fleet is unavailable, so it picks this up once it runs again."),
			),
		);
		const saved = yield* Effect.promise(() => readResponses(decisionId, "direction"));
		expect(saved.responses).toHaveLength(1);
		expect(saved.responses[0]?.response).toMatchObject({
			answers: [{ prompt: "answer", selected: ["option-1"], text: "Use the reviewed version." }],
			author: "Reviewer",
		});
	},
);

screenStory.it(
	"opens a Today ask directly on the item and focuses its answer card",
	[screenWorkspace("answer-card-fixture"), routedScreen(answerCardFixture, "/")],
	function* ({ click, findElement, readFocus, location }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-attention-row] a[title]")).not.toBeNull()));
		const link = findElement<HTMLAnchorElement>("[data-attention-row] a[title]");
		expect(link?.getAttribute("href")).toBe(`${url}#answer-card-direction`);
		click(link);
		yield* Effect.promise(() => eventually(() => expect(location()?.pathname).toBe(url)));
		expect(location()?.hash).toBe("answer-card-direction");
		yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe("answer-card-direction")));
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
					"---\nid: question.invalid\nkind: question\nstatus: open\noptions:\n - label: ''\n   description: Invalid choice\n---\n# Choose a direction\n",
			},
			"/_board/item/question.invalid/",
		),
	],
	function* ({ readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText(".response-panel h2")).toBe("Answer unavailable")));
		expect(readText(".response-panel")).not.toContain("Question closed");
		expect(readText(".item-summary")).toContain("needs-you");
	},
);

screenStory.it(
	"puts the recommendation and primary PR action above secondary human choices without initial author errors",
	[
		screenWorkspace("answer-card-fixture"),
		storedScreenState({ "work-board:author:answer-card-fixture": "Last reviewer" }),
		routedScreen(readyDecisionFixture, url),
	],
	function* ({ answerInput, responseClick, findElement, readText, findElements, readAttribute, submit }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		const card = findElement(".response-panel");
		expect(readText(".answer-recommendation", card)).toBe("Merge the reviewed PR on GitHub.");
		const link = findElement(".answer-links a", card);
		expect(link?.textContent).toBe("Open PR #395");
		expect(link?.getAttribute("href")).toBe("https://github.com/ShivaeDev/platform/pull/395");
		expect(link?.classList.contains("bg-primary")).toBe(true);
		expect(link?.compareDocumentPosition(findElement("fieldset", card) ?? document.body)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect([...(findElements(".question-choice strong", card) ?? [])].map((label) => label.textContent)).toEqual(["Request changes", "Release"]);
		expect(findElement<HTMLInputElement>('[name="author"]', card)?.value).toBe("Last reviewer");
		expect(readAttribute('[name="author"]', "aria-invalid", card)).toBe("false");
		expect(card?.textContent).not.toContain("Add your local author label.");
		expect(readText(".item-summary")).not.toContain("Not recorded");
		expect(readAttribute(".item-summary [data-status-token]", "data-status-token")).toBe("needs-you");
		expect(readText("article.doc")).not.toContain("Publish the reviewed guide");
		answerInput("author", "");
		responseClick("preview");
		expect(card?.textContent).not.toContain("Add your local author label.");
		submit("#response-form");
		yield* Effect.promise(() => eventually(() => expect(readAttribute('[name="author"]', "aria-invalid", card)).toBe("true")));
		yield* Effect.promise(() => eventually(() => expect(findElement('details[data-key="response-details"]', card)).toHaveProperty("open", true)));
		expect(card?.textContent).toContain("Add your local author label.");
	},
);

for (const heading of ["### Release ownership", ""]) {
	const files = { ...readyDecisionFixture, [decisionFile]: (readyDecisionFixture[decisionFile] ?? "").replace("### Release", heading) };
	screenStory.it(
		`uses an option heading or capitalised id: ${heading}`,
		[screenWorkspace("answer-card-fixture"), routedScreen(files, url)],
		function* ({ findElements }) {
			yield* Effect.promise(() => eventually(() => expect(findElements(".question-choice strong")).toHaveLength(2)));
			expect(findElements(".question-choice strong")[1]?.textContent).toBe(heading ? "Release ownership" : "Release");
		},
	);
}

const files = { ...readyDecisionFixture, [decisionFile]: (readyDecisionFixture[decisionFile] ?? "").replace('select="one"', 'select="many"') };
screenStory.it(
	"toggles directive buttons when several choices are allowed",
	[screenWorkspace("answer-card-fixture"), routedScreen(files, url)],
	function* ({ click, findElement }) {
		yield* Effect.promise(() => eventually(() => expect(findElement(".question-choice")).not.toBeNull()));
		const button = findElement<HTMLButtonElement>(".question-choice");
		click(button);
		expect(button?.getAttribute("aria-pressed")).toBe("true");
		click(button);
		expect(button?.getAttribute("aria-pressed")).toBe("false");
	},
);
