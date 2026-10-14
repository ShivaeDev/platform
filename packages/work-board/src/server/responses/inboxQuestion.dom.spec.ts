import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { type OpenPage, openPage } from "#test/browser.ts";
import { enterField } from "#test/enterField.ts";
import { formEvent } from "#test/formEvent.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* () {
	notes = folder({ "question.md": inboxQuestion, "readme.md": "# Project notes" });
	board = yield* startBoard(notes.root, undefined, (fs) => fs, true);
	page = yield* openPage(board, "/_board/item/question.storage/");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false)));
	yield* formEvent(page, () => enterField(page, "author", "Casey"));
});

function click(id: string) {
	page.document.getElementById(id)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
}

const answer = Effect.fn("Test.answer")(function* () {
	yield* formEvent(page, () => click("response-preview"));
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
	page.document.getElementById("response-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Saved:")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("inbox-count")?.textContent).toBe("0")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("inbox-topbar-count")?.textContent).toBe("0")));
	expect((yield* rawGet(board, "/_board/inbox")).body).toContain("0 waiting");
	expect(readFileSync(join(notes.root, "question.md"), "utf8")).toBe(inboxQuestion);
	const saved = readdirSync(join(notes.root, "responses")).find((file) => file.startsWith("response."));
	if (!saved) {
		throw new Error("No response saved");
	}
	return metadataParse(readFileSync(join(notes.root, "responses", saved), "utf8"));
});

it.live("records a recommended option from the item page and updates the live Inbox badge", function* () {
	yield* open();
	expect(page.document.querySelectorAll("input:checked")).toHaveLength(0);
	const clear = page.document.querySelector("[data-clear-choices]");
	if (!(clear instanceof page.window.HTMLButtonElement)) {
		throw new Error("Missing Clear selection control");
	}
	expect(clear.nextElementSibling?.tagName).toBe("LABEL");
	expect(page.window.getComputedStyle(clear).marginBottom).toBe("16px");
	yield* formEvent(page, () =>
		page.document.querySelector('[data-choice="option-1"]')?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true })),
	);
	expect(page.document.querySelector('[data-choice="option-1"]')?.getAttribute("aria-pressed")).toBe("true");
	const response = yield* answer();
	expect(response.fields.kind).toBe("response");
	expect(response.fields.response?.answers?.[0]?.selected).toEqual(["option-1"]);
	expect(response.body).toContain("Keep local files");
});

it.live("keeps the remembered author under More across questions with one visible answer box", function* () {
	yield* open();
	expect(page.document.querySelector('[data-key="response-details"]')?.hasAttribute("open")).toBe(false);
	const textareas = [...page.document.querySelectorAll("#response-form textarea")];
	expect(textareas.filter((field) => !field.closest("details"))).toHaveLength(1);
	expect(page.document.querySelector('[name="author"]')?.closest("details")?.getAttribute("data-key")).toBe("response-details");
	for (const name of ["type", "supersedes"]) {
		expect(page.document.querySelector(`[name="${name}"]`)?.closest("details")?.getAttribute("data-key")).toBe("response-details");
	}
	notes.write("other.md", inboxQuestion.replace("question.storage", "question.backup"));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('#files a[href="/other.md"]')).not.toBeNull()));
	yield* formEvent(page, () =>
		page.document
			.querySelector('#files a[href="/other.md"]')
			?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true })),
	);
	yield* Effect.promise(() =>
		waitFor(() => expect(page.document.getElementById("response-form")?.getAttribute("data-item")).toBe("question.backup")),
	);
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[name="author"]')).toHaveProperty("value", "Casey")));
});

it.live("records a free-text answer and returns an edited question to the Inbox", function* () {
	yield* open();
	const text = page.document.querySelector("[data-answer-text]");
	if (!(text instanceof page.window.HTMLTextAreaElement)) {
		throw new Error("Missing text answer");
	}
	text.value = "Keep files and add an export later.";
	yield* formEvent(page, () => text.dispatchEvent(new page.window.Event("input", { bubbles: true })));
	const response = yield* answer();
	expect(response.fields.response?.answers?.[0]).toMatchObject({ selected: [], text: "Keep files and add an export later." });
	notes.write("question.md", `${inboxQuestion}\nWhat about backups?`);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("inbox-count")?.textContent).toBe("1")));
});

it.live("opens a question through native Inbox navigation and refreshes a closed question out of the queue", function* () {
	yield* open();
	yield* Effect.promise(() => page.close());
	page = yield* openPage(board, "/_board/inbox");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live")));
	expect(page.document.querySelectorAll(".inbox-row")).toHaveLength(1);
	expect(page.document.getElementById("inbox-topbar")?.getAttribute("aria-current")).toBe("page");
	for (const id of ["inbox-count", "inbox-topbar-count"]) {
		expect(page.document.getElementById(id)?.textContent).toBe("1");
	}
	yield* formEvent(page, () =>
		page.document.querySelector(".inbox-row a")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true })),
	);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-form")).not.toBeNull()));
	expect(page.window.location.pathname).toBe("/_board/item/question.storage/");
	expect(page.window.location.hash).toBe("#answer-card-answer");
	const location = page.window.location.href;
	notes.write("question.md", inboxQuestion.replace("status: open", "status: closed"));
	yield* Effect.promise(() =>
		waitFor(() => {
			for (const id of ["inbox-count", "inbox-topbar-count"]) {
				expect(page.document.getElementById(id)?.textContent).toBe("0");
				expect(page.document.getElementById(id)?.getAttribute("aria-label")).toBe("0 waiting");
			}
		}),
	);
	expect(page.window.location.href).toBe(location);
	yield* formEvent(page, () =>
		page.document.getElementById("inbox-open")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true })),
	);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-view")).toBe("inbox")));
	yield* Effect.promise(() => waitFor(() => expect(page.document.querySelectorAll(".inbox-row")).toHaveLength(0)));
});

it.live("updates both Inbox counts when a question closes while an unrelated document stays mounted", function* () {
	yield* open();
	yield* Effect.promise(() => page.close());
	page = yield* openPage(board, "/readme.md");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live")));
	const document = page.document.getElementById("doc");
	for (const id of ["inbox-count", "inbox-topbar-count"]) {
		expect(page.document.getElementById(id)?.textContent).toBe("1");
	}
	notes.write("question.md", inboxQuestion.replace("status: open", "status: closed"));
	yield* Effect.promise(() =>
		waitFor(() => {
			for (const id of ["inbox-count", "inbox-topbar-count"]) {
				expect(page.document.getElementById(id)?.textContent).toBe("0");
				expect(page.document.getElementById(id)?.getAttribute("aria-label")).toBe("0 waiting");
			}
		}),
	);
	expect(page.document.getElementById("doc")).toBe(document);
	expect(page.window.location.pathname).toBe("/readme.md");
});
