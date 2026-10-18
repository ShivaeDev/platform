import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import {
	answerCardFixture,
	DECISION_REASON,
	decisionFile,
	decisionId,
	paragraphDecisionFixture,
	readyDecisionFixture,
} from "#test/answerCardFixture.ts";
import { answerInput, answerPrompt, responseClick } from "#test/answerDraft.tsx";
import { browserStorage } from "#test/browserStorage.ts";
import { renderBoard } from "#test/react.tsx";
import { renderRouter } from "#test/renderRouter.tsx";
import { responseCommands } from "#test/responseCommands.ts";
import { boardRouter } from "./boardRouter.ts";
import { documentQuery } from "./routeQuery.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => {
	browserStorage();
	document.documentElement.dataset.workspace = "answer-card-fixture";
});
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	delete document.documentElement.dataset.workspace;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
const url = `/_board/item/${decisionId}/`;

it.each(["fenced", "nested", "paragraphs"])(
	"renders a managed decision with a %s reason once below its header and uses the unblocked item's title",
	async (mode) => {
		const files = { ...(mode === "paragraphs" ? paragraphDecisionFixture : answerCardFixture) };
		if (mode === "nested") {
			const source = files[decisionFile];
			if (source === undefined) {
				throw new Error("Missing decision fixture");
			}
			files[decisionFile] = source.replace(DECISION_REASON, `~~~~\n${DECISION_REASON}\n~~~~`);
		}
		const view = await renderRouter(files, url);
		try {
			await eventually(() => expect(view.container.querySelector("#response-form")).not.toBeNull());
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
		} finally {
			await view.unmount();
		}
	},
);

it("retains an option and free text through a document query refresh and records through the existing response action", async () => {
	let refresh: (() => void) | undefined;
	const files = { ...answerCardFixture };
	const view = await renderBoard(
		files,
		(api, registry) => {
			refresh = () => registry.refresh(documentQuery(api, url));
			const router = boardRouter({ api, registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [url] }) });
			return <RouterProvider router={router} />;
		},
		{ home: "home.md", writable: true },
	);
	const { register, record } = responseCommands(view.forms);
	try {
		await eventually(() => expect(view.container.querySelector(".question-choice")).not.toBeNull());
		answerInput("author", "Reviewer");
		act(() => view.container.querySelector<HTMLButtonElement>(".question-choice")?.click());
		const input = answerPrompt("answer", "Use the reviewed version.");
		input.focus();
		input.setSelectionRange(4, 7);
		await act(async () => refresh?.());
		await eventually(() => expect(view.container.querySelector(".question-choice")?.getAttribute("aria-pressed")).toBe("true"));
		expect(answerPrompt("answer")).toBe(input);
		expect(input.value).toBe("Use the reviewed version.");
		expect(document.activeElement).toBe(input);
		expect([input.selectionStart, input.selectionEnd]).toEqual([4, 7]);
		await act(async () => responseClick("submit"));
		await eventually(() => expect(document.getElementById("response-status")?.textContent).toContain("Saved:"));
		expect(register).toHaveBeenCalledTimes(1);
		expect(record).toHaveBeenCalledTimes(1);
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({
				answers: [{ prompt: "answer", selected: ["option-1"], text: "Use the reviewed version." }],
				author: "Reviewer",
				question: "question.fixture",
			}),
		);
	} finally {
		await view.unmount();
	}
});

it("opens a Today ask directly on the item and focuses its answer card", async () => {
	const view = await renderRouter(answerCardFixture, "/");
	try {
		await eventually(() => expect(view.container.querySelector("[data-attention-row] a[title]")).not.toBeNull());
		const link = view.container.querySelector<HTMLAnchorElement>("[data-attention-row] a[title]");
		expect(link?.getAttribute("href")).toBe(`${url}#answer-card-direction`);
		await act(async () => link?.click());
		await eventually(() => expect(view.router.state.location.pathname).toBe(url));
		expect(view.router.state.location.hash).toBe("answer-card-direction");
		await eventually(() => expect(document.activeElement?.id).toBe("answer-card-direction"));
	} finally {
		await view.unmount();
	}
});

it("labels a malformed open question unavailable while retaining its source status", async () => {
	const view = await renderRouter(
		{
			"home.md": "# Home",
			"question.md":
				"---\nid: question.invalid\nkind: question\nstatus: open\noptions:\n - label: ''\n   description: Invalid choice\n---\n# Choose a direction\n",
		},
		"/_board/item/question.invalid/",
	);
	try {
		await eventually(() => expect(view.container.querySelector(".response-panel h2")?.textContent).toBe("Answer unavailable"));
		expect(view.container.querySelector(".response-panel")?.textContent).not.toContain("Question closed");
		expect(view.container.querySelector(".item-summary")?.textContent).toContain("needs-you");
	} finally {
		await view.unmount();
	}
});

it("puts the recommendation and primary PR action above secondary human choices without initial author errors", async () => {
	localStorage.setItem("work-board:author:answer-card-fixture", "Last reviewer");
	const view = await renderRouter(readyDecisionFixture, url);
	try {
		await eventually(() => expect(view.container.querySelector("#response-form")).not.toBeNull());
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
		await act(async () => card?.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
		await eventually(() => expect(card?.querySelector('[name="author"]')?.getAttribute("aria-invalid")).toBe("true"));
		await eventually(() => expect(card?.querySelector('details[data-key="response-details"]')).toHaveProperty("open", true));
		expect(card?.textContent).toContain("Add your local author label.");
	} finally {
		await view.unmount();
	}
});

it.each(["### Release ownership", ""])("uses an option heading or capitalised id: %s", async (heading) => {
	const files = { ...readyDecisionFixture, [decisionFile]: (readyDecisionFixture[decisionFile] ?? "").replace("### Release", heading) };
	const view = await renderRouter(files, url);
	try {
		await eventually(() => expect(view.container.querySelectorAll(".question-choice strong")).toHaveLength(2));
		expect(view.container.querySelectorAll(".question-choice strong")[1]?.textContent).toBe(heading ? "Release ownership" : "Release");
	} finally {
		await view.unmount();
	}
});

it("toggles directive buttons when several choices are allowed", async () => {
	const files = { ...readyDecisionFixture, [decisionFile]: (readyDecisionFixture[decisionFile] ?? "").replace('select="one"', 'select="many"') };
	const view = await renderRouter(files, url);
	try {
		await eventually(() => expect(view.container.querySelector(".question-choice")).not.toBeNull());
		const button = view.container.querySelector<HTMLButtonElement>(".question-choice");
		act(() => button?.click());
		expect(button?.getAttribute("aria-pressed")).toBe("true");
		act(() => button?.click());
		expect(button?.getAttribute("aria-pressed")).toBe("false");
	} finally {
		await view.unmount();
	}
});
