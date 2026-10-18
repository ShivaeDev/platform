import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import {
	answerCardFixture,
	DECISION_REASON,
	decisionFile,
	decisionId,
	paragraphDecisionFixture,
	readyDecisionFixture,
} from "#test/answerCardFixture.ts";
import { responseCommands } from "#test/responseCommands.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen, storedScreenState } from "#test/screenTraits.ts";
import { documentQuery } from "./routeQuery.ts";

expectNoReactWarnings();
beforeEach(() => {
	document.documentElement.dataset.workspace = "answer-card-fixture";
});
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	delete document.documentElement.dataset.workspace;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
const url = `/_board/item/${decisionId}/`;

for (const mode of ["fenced", "nested", "paragraphs"]) {
	screenStory.it(
		`renders a managed decision with a ${mode} reason once below its header and uses the unblocked item's title`,
		[],
		function* ({ renderRouter }) {
			const files = { ...(mode === "paragraphs" ? paragraphDecisionFixture : answerCardFixture) };
			if (mode === "nested") {
				const source = files[decisionFile];
				if (source === undefined) {
					throw new Error("Missing decision fixture");
				}
				files[decisionFile] = source.replace(DECISION_REASON, `~~~~\n${DECISION_REASON}\n~~~~`);
			}
			const view = yield* Effect.promise(() => renderRouter(files, url));

			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#response-form")).not.toBeNull()));
			expect(view.container.querySelector('[name="author"]')?.getAttribute("aria-invalid")).toBe("false");
			expect(view.container.querySelector(".response-panel")?.textContent).not.toContain("Add your local author label.");
			const header = view.container.querySelector(".item-introduction");
			expect(header?.querySelector("h1")?.textContent).toBe("Publish the install guide");
			expect(view.container.querySelector('[aria-label="File location"]')?.textContent).toContain("Publish the install guide");
			expect(view.container.querySelector('[aria-label="File location"]')?.textContent).not.toContain(decisionId);
			expect(header?.nextElementSibling?.classList.contains("answer-cards")).toBe(true);
			expect(view.container.querySelector("#answer-title-direction")?.textContent).toBe("Answer: Publish the install guide");
			expect(view.container.querySelector(".answer-reason strong")?.textContent).toBe("Which publishing path should we take?");
			expect(view.container.querySelector(".answer-reason a")?.getAttribute("href")).toBe("https://example.com/releases");
			expect(view.container.querySelector("article.doc")?.textContent).not.toContain("Which publishing path");
			if (mode === "paragraphs") {
				expect(view.container.querySelector("article.doc")?.textContent).toContain("Preserve this background before the decision.");
				expect(view.container.querySelector("article.doc")?.textContent).toContain("Preserve this conclusion after the decision.");
				expect(view.container.querySelector("article.doc")?.textContent).not.toContain("Read the release guide.");
				expect(view.container.querySelectorAll(".answer-reason p")).toHaveLength(2);
			}
			expect([...view.container.querySelectorAll(".question-choice")].map((button) => button.textContent)).toEqual([
				"Publish now · RecommendedShip the reviewed guide with this release.",
				"Wait for reviewKeep the work blocked until another review.",
			]);
			expect(view.container.querySelector(".item-summary")?.textContent).not.toContain(decisionId);
			expect(view.container.querySelector('[aria-label="Document source"] pre')?.textContent?.split(decisionId)).toHaveLength(2);
			expect([...view.container.querySelectorAll("h1,h2,[title]")].every((element) => !/[a-f\d]{64}/u.test(element.textContent ?? ""))).toBe(true);
		},
	);
}

screenStory.it(
	"retains an option and free text through a document query refresh and records through the existing response action",
	[],
	function* ({ answerInput, click, answerPrompt, responseClick, renderRouter }) {
		let refresh: (() => void) | undefined;
		const files = { ...answerCardFixture };
		const view = yield* Effect.promise(() =>
			renderRouter(files, url, { home: "home.md", writable: true }, (api, registry) => {
				refresh = () => registry.refresh(documentQuery(api, url));
			}),
		);
		const { register, record } = responseCommands(view.forms);

		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(".question-choice")).not.toBeNull()));
		answerInput("author", "Reviewer");
		click(view.container.querySelector<HTMLButtonElement>(".question-choice"));
		const input = answerPrompt("answer", "Use the reviewed version.");
		input.focus();
		input.setSelectionRange(4, 7);
		yield* Effect.promise(() => act(async () => refresh?.()));
		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector(".question-choice")?.getAttribute("aria-pressed")).toBe("true")),
		);
		expect(answerPrompt("answer")).toBe(input);
		expect(input.value).toBe("Use the reviewed version.");
		expect(document.activeElement).toBe(input);
		expect([input.selectionStart, input.selectionEnd]).toEqual([4, 7]);
		yield* Effect.promise(() => act(async () => responseClick("submit")));
		yield* Effect.promise(() => eventually(() => expect(document.getElementById("response-status")?.textContent).toContain("Saved:")));
		expect(register).toHaveBeenCalledTimes(1);
		expect(record).toHaveBeenCalledTimes(1);
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({
				answers: [{ prompt: "answer", selected: ["option-1"], text: "Use the reviewed version." }],
				author: "Reviewer",
				question: "question.fixture",
			}),
		);
	},
);

screenStory.it(
	"opens a Today ask directly on the item and focuses its answer card",
	[routedScreen(answerCardFixture, "/")],
	function* ({ routed, click }) {
		const view = routed();

		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("[data-attention-row] a[title]")).not.toBeNull()));
		const link = view.container.querySelector<HTMLAnchorElement>("[data-attention-row] a[title]");
		expect(link?.getAttribute("href")).toBe(`${url}#answer-card-direction`);
		click(link);
		yield* Effect.promise(() => eventually(() => expect(view.router.state.location.pathname).toBe(url)));
		expect(view.router.state.location.hash).toBe("answer-card-direction");
		yield* Effect.promise(() => eventually(() => expect(document.activeElement?.id).toBe("answer-card-direction")));
	},
);

screenStory.it(
	"labels a malformed open question unavailable while retaining its source status",
	[
		routedScreen(
			{
				"home.md": "# Home",
				"question.md":
					"---\nid: question.invalid\nkind: question\nstatus: open\noptions:\n - label: ''\n   description: Invalid choice\n---\n# Choose a direction\n",
			},
			"/_board/item/question.invalid/",
		),
	],
	function* ({ routed }) {
		const view = routed();

		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(".response-panel h2")?.textContent).toBe("Answer unavailable")));
		expect(view.container.querySelector(".response-panel")?.textContent).not.toContain("Question closed");
		expect(view.container.querySelector(".item-summary")?.textContent).toContain("needs-you");
	},
);

screenStory.it(
	"puts the recommendation and primary PR action above secondary human choices without initial author errors",
	[storedScreenState({ "work-board:author:answer-card-fixture": "Last reviewer" }), routedScreen(readyDecisionFixture, url)],
	function* ({ routed, answerInput, responseClick }) {
		const view = routed();

		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#response-form")).not.toBeNull()));
		const card = view.container.querySelector(".response-panel");
		expect(card?.querySelector(".answer-recommendation")?.textContent).toBe("Merge the reviewed PR on GitHub.");
		const link = card?.querySelector(".answer-links a");
		expect(link?.textContent).toBe("Open PR #395");
		expect(link?.getAttribute("href")).toBe("https://github.com/ShivaeDev/platform/pull/395");
		expect(link?.classList.contains("bg-primary")).toBe(true);
		expect(link?.compareDocumentPosition(card?.querySelector("fieldset") ?? document.body)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect([...(card?.querySelectorAll(".question-choice strong") ?? [])].map((label) => label.textContent)).toEqual(["Request changes", "Release"]);
		expect(card?.querySelector<HTMLInputElement>('[name="author"]')?.value).toBe("Last reviewer");
		expect(card?.querySelector('[name="author"]')?.getAttribute("aria-invalid")).toBe("false");
		expect(card?.textContent).not.toContain("Add your local author label.");
		expect(view.container.querySelector(".item-summary")?.textContent).not.toContain("Not recorded");
		expect(view.container.querySelector(".item-summary [data-status-token]")?.getAttribute("data-status-token")).toBe("needs-you");
		expect(view.container.querySelector("article.doc")?.textContent).not.toContain("Publish the reviewed guide");
		answerInput("author", "");
		responseClick("preview");
		expect(card?.textContent).not.toContain("Add your local author label.");
		yield* Effect.promise(() =>
			act(async () => card?.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))),
		);
		yield* Effect.promise(() => eventually(() => expect(card?.querySelector('[name="author"]')?.getAttribute("aria-invalid")).toBe("true")));
		yield* Effect.promise(() => eventually(() => expect(card?.querySelector('details[data-key="response-details"]')).toHaveProperty("open", true)));
		expect(card?.textContent).toContain("Add your local author label.");
	},
);

for (const heading of ["### Release ownership", ""]) {
	screenStory.it(`uses an option heading or capitalised id: ${heading}`, [], function* ({ renderRouter }) {
		const files = { ...readyDecisionFixture, [decisionFile]: (readyDecisionFixture[decisionFile] ?? "").replace("### Release", heading) };
		const view = yield* Effect.promise(() => renderRouter(files, url));

		yield* Effect.promise(() => eventually(() => expect(view.container.querySelectorAll(".question-choice strong")).toHaveLength(2)));
		expect(view.container.querySelectorAll(".question-choice strong")[1]?.textContent).toBe(heading ? "Release ownership" : "Release");
	});
}

screenStory.it("toggles directive buttons when several choices are allowed", [], function* ({ renderRouter, click }) {
	const files = { ...readyDecisionFixture, [decisionFile]: (readyDecisionFixture[decisionFile] ?? "").replace('select="one"', 'select="many"') };
	const view = yield* Effect.promise(() => renderRouter(files, url));

	yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(".question-choice")).not.toBeNull()));
	const button = view.container.querySelector<HTMLButtonElement>(".question-choice");
	click(button);
	expect(button?.getAttribute("aria-pressed")).toBe("true");
	click(button);
	expect(button?.getAttribute("aria-pressed")).toBe("false");
});
