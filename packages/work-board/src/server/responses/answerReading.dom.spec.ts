import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { waitFor } from "#test/live.ts";
import { capturedQuestionnaire, questionnaireSource, scopedQuestionnaire } from "#test/questionnaire.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* (source = questionnaireSource, responses = true) {
	notes = folder({ "decision.md": source, "task.md": "# Affected work" });
	board = yield* startBoard(notes.root, undefined, (fs) => fs, responses);
	page = yield* openPage(board, "/_board/item/investigation.choices/");
});

it.live("starts each open packet with a primary action that opens its existing answer form", function* () {
	yield* open();
	const currentPage = page;
	const questions = [...page.document.querySelectorAll(".questionnaire-question")];
	expect(questions).toHaveLength(2);
	expect(page.document.querySelectorAll(".questionnaire-answer")).toHaveLength(1);
	expect(questions[1]?.querySelector(".questionnaire-answer")).toBeNull();
	for (const question of questions.slice(0, 1)) {
		const action = question.firstElementChild?.querySelector("a");
		expect(action?.textContent).toBe("Answer these questions");
		expect(action?.classList.contains("questionnaire-answer")).toBe(true);
		expect(action?.closest("details")).toBeNull();
		expect(action?.getAttribute("href")).toBe("/_board/respond?item=investigation.choices&request=direction");
		const response = yield* rawGet(board, action?.getAttribute("href") ?? "");
		expect(response.status).toBe(200);
		action?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true }));
		yield* Effect.promise(() => waitFor(() => expect(currentPage.document.querySelector('#response-form input[type="radio"]')).not.toBeNull()));
		expect(page.document.querySelector('#response-form input[type="checkbox"]')).not.toBeNull();
	}
});

it.live.each([
	["responses disabled", questionnaireSource, false],
	["request closed", questionnaireSource.replace("state: open", "state: closed"), true],
] as const)("keeps options readable without control affordances with %s", function* ([_label, source, responses]) {
	yield* open(source, responses);
	expect(page.document.querySelector(".questionnaire-answer")).toBeNull();
	const css = (yield* rawGet(board, "/_board/style.css")).body;
	const stylesheet = page.document.createElement("style");
	stylesheet.textContent = css;
	page.document.head.append(stylesheet);
	const options = [...page.document.querySelectorAll(".questionnaire-option")];
	expect(options).toHaveLength(4);
	for (const option of options) {
		expect(option.querySelector("input, button, label, [role=radio], [role=checkbox]")).toBeNull();
		expect(option.hasAttribute("tabindex")).toBe(false);
		const style = page.window.getComputedStyle(option);
		expect(style.cursor).not.toBe("pointer");
		expect(style.borderTopStyle).not.toBe("solid");
		expect(style.borderLeftStyle).toBe("solid");
	}
	expect(css).not.toMatch(/\.questionnaire-option[^{}]*(?:::before|::after|:hover)/u);
});

it.live.each(["managed", "registered", "needs-human"])("links an open packet from Inbox straight to the response form (%s)", function* (mode) {
	const registered = mode !== "managed";
	let source = questionnaireSource;
	if (mode === "managed") {
		source = source.replace("kind: decision", "kind: decision\n    managed: true");
	}
	if (mode === "needs-human") {
		source = source.replace("kind: investigation", "kind: investigation\nstatus: needs-human");
	}
	notes = folder({ "decision.md": source, ...(registered ? { "responses/question.md": capturedQuestionnaire(source) } : {}) });
	board = yield* startBoard(notes.root, undefined, (fs) => fs, true);
	page = yield* openPage(board, "/_board/inbox");
	const links = [...page.document.querySelectorAll(".inbox-row h3 a")];
	expect(links).toHaveLength(1);
	expect(links[0]?.getAttribute("href")).toBe("/_board/respond?item=investigation.choices&request=direction");
});

it.live.each(["open", "closed"])("keeps actions scoped to their own requests when the second request is %s", function* (state) {
	yield* open(scopedQuestionnaire.replace("kind: review\n    state: open", `kind: review\n    state: ${state}`));
	const questions = [...page.document.querySelectorAll(".questionnaire-question")];
	expect(questions[0]?.querySelector(".questionnaire-answer")?.getAttribute("href")).toBe(
		"/_board/respond?item=investigation.choices&request=direction",
	);
	const second = questions[1]?.querySelector(".questionnaire-answer");
	if (state === "closed") {
		expect(second).toBeNull();
	} else {
		expect(second?.getAttribute("href")).toBe("/_board/respond?item=investigation.choices&request=verification");
	}
});
