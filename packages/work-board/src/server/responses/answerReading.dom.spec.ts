import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
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

it.live("opens an answer card with packet controls through the legacy response URL", function* () {
	yield* open();
	expect(page.document.querySelectorAll("#answer-card-direction fieldset")).toHaveLength(2);
	expect(page.document.querySelectorAll("article.doc .questionnaire-question")).toHaveLength(0);
	expect(page.document.querySelector('#response-form input[type="radio"]')).not.toBeNull();
	expect(page.document.querySelector('#response-form input[type="checkbox"]')).not.toBeNull();
	const response = yield* rawGet(board, "/_board/respond?item=investigation.choices&request=direction");
	expect(response.status).toBe(302);
	expect(response.location).toBe("/_board/item/investigation.choices/#answer-card-direction");
});

it.live("shows an answer card with recording disabled in read-only mode", function* () {
	yield* open(questionnaireSource, false);
	expect(page.document.querySelectorAll("#answer-card-direction fieldset")).toHaveLength(2);
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
	expect(page.document.getElementById("response-status")?.textContent).toContain("Read-only mode");
});

it.live("retains the readable packet when its request is closed", function* () {
	yield* open(questionnaireSource.replace("state: open", "state: closed"));
	expect(page.document.querySelector("#answer-card-direction")).toBeNull();
	expect(page.document.querySelector(".questionnaire-answer")).toBeNull();
	expect(page.document.querySelectorAll(".questionnaire-option")).toHaveLength(4);
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

it.live.each(["open", "closed"])("keeps answer cards scoped when the second request is %s", function* (state) {
	yield* open(scopedQuestionnaire.replace("kind: review\n    state: open", `kind: review\n    state: ${state}`));
	const first = page.document.querySelector("#answer-card-direction");
	expect(first?.querySelector('[data-prompt="display"]')).not.toBeNull();
	expect(first?.querySelector('[data-prompt="checks"]')).toBeNull();
	const second = page.document.querySelector("#answer-card-verification");
	if (state === "closed") {
		expect(second).toBeNull();
		expect(page.document.querySelectorAll(".questionnaire-question")).toHaveLength(1);
	} else {
		expect(first?.querySelector("fieldset")?.getAttribute("data-mode")).toBe("one");
		expect(second?.querySelector("fieldset")?.getAttribute("data-mode")).toBe("many");
		const ids = [...page.document.querySelectorAll(".answer-cards [id]")].map((element) => element.id);
		expect(new Set(ids).size).toBe(ids.length);
	}
});
