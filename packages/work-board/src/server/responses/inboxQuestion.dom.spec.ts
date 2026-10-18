import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, readerAt, responsesEnabled } from "#test/boardStory.ts";
import { formEvent } from "#test/formEvent.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { waitFor } from "#test/live.ts";
import { waitForLibraryCount } from "#test/nativeRpc.ts";
import { anAnswerForm, anOpenQuestion, aRememberedAuthor } from "#test/storyTraits.ts";

boardStory.it(
	"records a recommended option from the item page and updates the live Inbox badge",
	[anOpenQuestion(), responsesEnabled(), readerAt("/_board/item/question.storage/"), anAnswerForm(), aRememberedAuthor("Casey")],
	function* ({ page, reader, saveAnswer }) {
		expect(page.document.querySelectorAll("input:checked")).toHaveLength(0);
		const clear = page.document.querySelector("[data-clear-choices]");
		if (!(clear instanceof page.window.HTMLButtonElement)) {
			throw new Error("Missing Clear selection control");
		}
		expect(clear.nextElementSibling?.tagName).toBe("LABEL");
		yield* reader.chooseOption("option-1");
		expect(page.document.querySelector('[data-choice="option-1"]')?.getAttribute("aria-pressed")).toBe("true");
		const response = yield* saveAnswer();
		expect(response.fields.kind).toBe("response");
		expect(response.fields.response?.answers?.[0]?.selected).toEqual(["option-1"]);
		expect(response.body).toContain("Keep local files");
	},
);

boardStory.it(
	"keeps the remembered author under More across questions with one visible answer box",
	[anOpenQuestion(), responsesEnabled(), readerAt("/_board/item/question.storage/"), anAnswerForm(), aRememberedAuthor("Casey")],
	function* ({ board, page, editFile, reader }) {
		expect(page.document.querySelector('[data-key="response-details"]')?.hasAttribute("open")).toBe(false);
		const textareas = [...page.document.querySelectorAll("#response-form textarea")];
		expect(textareas.filter((field) => !field.closest("details"))).toHaveLength(1);
		expect(page.document.querySelector('[name="author"]')?.closest("details")?.getAttribute("data-key")).toBe("response-details");
		for (const name of ["type", "supersedes"]) {
			expect(page.document.querySelector(`[name="${name}"]`)?.closest("details")?.getAttribute("data-key")).toBe("response-details");
		}
		editFile("other.md", inboxQuestion.replace("question.storage", "question.backup"));
		yield* waitForLibraryCount(board, 3);
		yield* reader.follow("/other.md");
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.getElementById("response-form")?.getAttribute("data-item")).toBe("question.backup")),
		);
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[name="author"]')).toHaveProperty("value", "Casey")));
	},
);

boardStory.it(
	"records a free-text answer and returns an edited question to the Inbox",
	[anOpenQuestion(), responsesEnabled(), readerAt("/_board/item/question.storage/"), anAnswerForm(), aRememberedAuthor("Casey")],
	function* ({ page, reader, editFile, saveAnswer }) {
		yield* reader.enterAnswer("Keep files and add an export later.");
		const response = yield* saveAnswer();
		expect(response.fields.response?.answers?.[0]).toMatchObject({ selected: [], text: "Keep files and add an export later." });
		editFile("question.md", `${inboxQuestion}\nWhat about backups?`);
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("inbox-count")?.textContent).toBe("1")));
	},
);

boardStory.it(
	"opens a question through native Inbox navigation and refreshes a closed question out of the queue",
	[anOpenQuestion(), responsesEnabled(), readerAt("/_board/item/question.storage/"), anAnswerForm(), aRememberedAuthor("Casey")],
	function* ({ page, reader, editFile }) {
		page = yield* reader.open("/");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live")));
		expect(page.document.querySelectorAll("[data-attention-row]")).toHaveLength(1);
		expect(page.document.getElementById("inbox-topbar")?.getAttribute("aria-current")).toBe("page");
		for (const id of ["inbox-count", "inbox-topbar-count"]) {
			expect(page.document.getElementById(id)?.textContent).toBe("1");
		}
		yield* formEvent(page, () =>
			page.document.querySelector("[data-attention-row] a")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true })),
		);
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-form")).not.toBeNull()));
		expect(page.window.location.pathname).toBe("/_board/item/question.storage/");
		expect(page.window.location.hash).toBe("#answer-card-answer");
		const location = page.window.location.href;
		editFile("question.md", inboxQuestion.replace("status: open", "status: closed"));
		yield* Effect.promise(() =>
			waitFor(() => {
				for (const id of ["inbox-count", "inbox-topbar-count"]) {
					expect(page.document.getElementById(id)?.textContent).toBe("0");
					expect(page.document.getElementById(id)?.getAttribute("aria-label")).toBe("0 need you");
				}
			}),
		);
		expect(page.window.location.href).toBe(location);
		yield* formEvent(page, () =>
			page.document.getElementById("inbox-topbar")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, cancelable: true })),
		);
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-view")).toBe("today")));
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelectorAll("[data-attention-row]")).toHaveLength(0)));
	},
);

boardStory.it(
	"updates both Inbox counts when a question closes while an unrelated document stays mounted",
	[anOpenQuestion(), responsesEnabled(), readerAt("/_board/item/question.storage/"), anAnswerForm(), aRememberedAuthor("Casey")],
	function* ({ page, reader, editFile }) {
		page = yield* reader.open("/readme.md");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.getAttribute("data-state")).toBe("live")));
		const document = page.document.getElementById("doc");
		for (const id of ["inbox-count", "inbox-topbar-count"]) {
			expect(page.document.getElementById(id)?.textContent).toBe("1");
		}
		editFile("question.md", inboxQuestion.replace("status: open", "status: closed"));
		yield* Effect.promise(() =>
			waitFor(() => {
				for (const id of ["inbox-count", "inbox-topbar-count"]) {
					expect(page.document.getElementById(id)?.textContent).toBe("0");
					expect(page.document.getElementById(id)?.getAttribute("aria-label")).toBe("0 need you");
				}
			}),
		);
		expect(page.document.getElementById("doc")).toBe(document);
		expect(page.window.location.pathname).toBe("/readme.md");
	},
);
