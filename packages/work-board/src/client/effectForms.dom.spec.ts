import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { held, type OpenPage, openPage } from "#test/browser.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { enterField } from "#test/enterField.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { rpcCall } from "#test/rpc.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;

afterEach(() => {
	notes?.remove();
});
const open = Effect.fn("Test.open")(function* (kind: "handoff" | "response", beforeScripts?: Parameters<typeof openPage>[2]) {
	notes = folder({ "item.md": EDGE_ATTENTION_SOURCE });
	board = yield* startBoard(notes.root, undefined, undefined, true);
	page = yield* openPage(
		board,
		kind === "handoff" ? "/_board/handoff?item=item.edge" : "/_board/respond?item=item.edge&request=direction",
		beforeScripts,
	);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById(`${kind}-preview`)?.hasAttribute("disabled")).toBe(false)));
});
function click(id: string) {
	page.document.getElementById(id)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
}

function submit(kind: string) {
	page.document.getElementById(`${kind}-form`)?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
}

it.live("shows Schema field messages for handoff direction and clears them when corrected", function* () {
	yield* open("handoff");
	yield* formEvent(page, () => enterField(page, "recipient", "agent-local"));
	const goal = enterField(page, "goal", " ");
	yield* formEvent(page, () => click("handoff-preview"));
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(true);
	expect(goal.validationMessage).toContain("RegExp");
	yield* formEvent(page, () => enterField(page, "goal", "Review the direction"));
	const recipient = enterField(page, "recipient", "x".repeat(201));
	yield* formEvent(page, () => click("handoff-preview"));
	expect(goal.validationMessage).toBe("");
	expect(recipient.validationMessage).toContain("200");
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(true);
	yield* formEvent(page, () => enterField(page, "recipient", "agent-local"));
	yield* formEvent(page, () => click("handoff-preview"));
	expect(recipient.validationMessage).toBe("");
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(false);
});

it.live("saves the captured response while retaining and resubmitting input typed during the command", function* () {
	const gate = held();
	let reached = false;
	yield* open("response", (window) => {
		const fetch = window.fetch.bind(window);
		window.fetch = async (input, init) => {
			const call = await rpcCall(window, input, init);
			if (call?.tag === "work-board.recordResponse" && !reached) {
				reached = true;
				await gate.gate;
			}
			return fetch(input, init);
		};
	});
	yield* formEvent(page, () => enterField(page, "author", "reviewer"));
	const body = enterField(page, "body", "First reviewed response");
	yield* formEvent(page, () => click("response-preview"));
	yield* formEvent(page, () => submit("response"));
	try {
		yield* Effect.promise(() => waitFor(() => expect(reached).toBe(true)));
		yield* formEvent(page, () => enterField(page, "body", "New direction typed while saving"));
	} finally {
		gate.release();
	}
	yield* Effect.promise(() =>
		waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Your current draft remains unsaved")),
	);
	yield* Effect.promise(() =>
		waitFor(() => expect(page.document.getElementById("response-history")?.textContent).toContain("First reviewed response")),
	);
	expect(body.value).toBe("New direction typed while saving");
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-preview")).toHaveProperty("disabled", false)));
	yield* formEvent(page, () => click("response-preview"));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-submit")).toHaveProperty("disabled", false)));
	yield* formEvent(page, () => submit("response"));
	yield* Effect.promise(() =>
		waitFor(() => expect(page.document.getElementById("response-history")?.textContent).toContain("New direction typed while saving")),
	);
	yield* Effect.promise(() => waitFor(() => expect(body.value).toBe("")));
});

it.live.each(["handoff", "response"] as const)("retains the %s form after persisted pageshow with the durable draft intact", function* (kind) {
	yield* open(kind);
	yield* formEvent(page, () => enterField(page, kind === "handoff" ? "recipient" : "author", "local-label"));
	yield* formEvent(page, () => enterField(page, kind === "handoff" ? "goal" : "body", "Direction before freezing"));
	yield* formEvent(page, () => page.window.dispatchEvent(new page.window.Event("pagehide")));
	yield* formEvent(page, () => page.window.dispatchEvent(Object.assign(new page.window.Event("pageshow"), { persisted: true })));
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById(`${kind}-preview`)).not.toBeNull()));
	expect(page.document.querySelector(kind === "handoff" ? '[name="goal"]' : '[name="body"]')).toHaveProperty("value", "Direction before freezing");
	yield* formEvent(page, () => click(`${kind}-preview`));
	expect(page.document.getElementById(`${kind}-submit`)?.hasAttribute("disabled")).toBe(false);
	yield* formEvent(page, () => submit(kind));
	yield* Effect.promise(() =>
		waitFor(() => expect(page.document.getElementById(`${kind}-status`)?.textContent).toContain(kind === "handoff" ? "Prepared:" : "Saved:")),
	);
});

it.live("puts each questionnaire Schema message on its own unanswered control", function* () {
	notes = folder({ "item.md": questionnaireSource });
	board = yield* startBoard(notes.root, undefined, undefined, true);
	page = yield* openPage(board, "/_board/respond?item=investigation.choices&request=direction");
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false)));
	yield* formEvent(page, () => enterField(page, "author", "reviewer"));
	const choice = page.document.querySelector('input[value="history"]');
	if (!(choice instanceof page.window.HTMLInputElement)) {
		throw new Error("Missing choice");
	}
	choice.checked = true;
	yield* formEvent(page, () => choice.dispatchEvent(new page.window.Event("input", { bubbles: true })));
	yield* formEvent(page, () => click("response-preview"));
	const texts = [...page.document.querySelectorAll("[data-answer-text]")];
	const [first, second] = texts;
	if (!(first instanceof page.window.HTMLTextAreaElement && second instanceof page.window.HTMLTextAreaElement)) {
		throw new Error("Missing answer controls");
	}
	expect(first.validationMessage).toBe("");
	expect(second.validationMessage).toBe("Choose an option or answer in your own words.");
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
	second.value = "My own answer";
	yield* formEvent(page, () => second.dispatchEvent(new page.window.Event("input", { bubbles: true })));
	yield* formEvent(page, () => click("response-preview"));
	expect(second.validationMessage).toBe("");
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
});
