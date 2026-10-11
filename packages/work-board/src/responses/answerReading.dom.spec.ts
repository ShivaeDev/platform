import { afterEach, expect, it } from "vitest";
import { legacyPage } from "#browser/react/legacyPage.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { capturedQuestionnaire, questionnaireSource, scopedQuestionnaire } from "#test/questionnaire.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
afterEach(async () => {
	await page?.close();
	await board?.stop();
	notes?.remove();
});

async function open(source = questionnaireSource, responses = true) {
	notes = folder({ "decision.md": source, "task.md": "# Affected work" });
	board = await startBoard(notes.root, undefined, (fs) => fs, responses);
	page = await openPage(board, "/_board/item/investigation.choices/");
}

it("starts each open packet with a primary action that opens its existing answer form", async () => {
	await open();
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
		const response = await rawGet(board, action?.getAttribute("href") ?? "");
		expect(response.status).toBe(200);
		const form = legacyPage(response.body);
		expect(form.querySelector('#response-form input[type="radio"]')).not.toBeNull();
		expect(form.querySelector('#response-form input[type="checkbox"]')).not.toBeNull();
	}
});

it.each([
	["responses disabled", questionnaireSource, false],
	["request closed", questionnaireSource.replace("state: open", "state: closed"), true],
])("keeps options readable without control affordances with %s", async (_label, source, responses) => {
	await open(source, responses);
	expect(page.document.querySelector(".questionnaire-answer")).toBeNull();
	const css = (await rawGet(board, "/_board/style.css")).body;
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

it.each(["managed", "registered", "needs-human"])("links an open packet from Inbox straight to the response form (%s)", async (mode) => {
	const registered = mode !== "managed";
	let source = questionnaireSource;
	if (mode === "managed") {
		source = source.replace("kind: decision", "kind: decision\n    managed: true");
	}
	if (mode === "needs-human") {
		source = source.replace("kind: investigation", "kind: investigation\nstatus: needs-human");
	}
	notes = folder({ "decision.md": source, ...(registered ? { "responses/question.md": capturedQuestionnaire(source) } : {}) });
	board = await startBoard(notes.root, undefined, (fs) => fs, true);
	page = await openPage(board, "/_board/inbox");
	const links = [...page.document.querySelectorAll(".inbox-row h3 a")];
	expect(links).toHaveLength(1);
	expect(links[0]?.getAttribute("href")).toBe("/_board/respond?item=investigation.choices&request=direction");
});

it.each(["open", "closed"])("keeps actions scoped to their own requests when the second request is %s", async (state) => {
	await open(scopedQuestionnaire.replace("kind: review\n    state: open", `kind: review\n    state: ${state}`));
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
