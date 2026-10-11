import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { held, type OpenPage, openPage } from "#test/browser.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { enterField } from "#test/enterField.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { rpcCall } from "#test/rpc.ts";

let notes: Folder;
let board: RunningBoard;
let page: OpenPage;
afterEach(async () => {
	await page?.close();
	await board?.stop();
	notes?.remove();
});
async function open(kind: "handoff" | "response", beforeScripts?: Parameters<typeof openPage>[2]) {
	notes = folder({ "item.md": EDGE_ATTENTION_SOURCE });
	board = await startBoard(notes.root, undefined, undefined, true);
	page = await openPage(
		board,
		kind === "handoff" ? "/_board/handoff?item=item.edge" : "/_board/respond?item=item.edge&request=direction",
		beforeScripts,
	);
	await waitFor(() => expect(page.document.getElementById(`${kind}-preview`)?.hasAttribute("disabled")).toBe(false));
}
function click(id: string) {
	page.document.getElementById(id)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
}
function submit(kind: string) {
	page.document.getElementById(`${kind}-form`)?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
}

it("shows Schema field messages for handoff direction and clears them when corrected", async () => {
	await open("handoff");
	enterField(page, "recipient", "agent-local");
	const goal = enterField(page, "goal", " ");
	click("handoff-preview");
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(true);
	expect(goal.validationMessage).toContain("RegExp");
	enterField(page, "goal", "Review the direction");
	const recipient = enterField(page, "recipient", "x".repeat(201));
	click("handoff-preview");
	expect(goal.validationMessage).toBe("");
	expect(recipient.validationMessage).toContain("200");
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(true);
	enterField(page, "recipient", "agent-local");
	click("handoff-preview");
	expect(recipient.validationMessage).toBe("");
	expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(false);
});

it("saves the captured response while retaining and resubmitting input typed during the command", async () => {
	const gate = held();
	let reached = false;
	await open("response", (window) => {
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
	enterField(page, "author", "reviewer");
	const body = enterField(page, "body", "First reviewed response");
	click("response-preview");
	submit("response");
	try {
		await waitFor(() => expect(reached).toBe(true));
		enterField(page, "body", "New direction typed while saving");
	} finally {
		gate.release();
	}
	await waitFor(() => expect(page.document.getElementById("response-status")?.textContent).toContain("Your current draft remains unsaved"));
	await waitFor(() => expect(page.document.getElementById("response-history")?.textContent).toContain("First reviewed response"));
	expect(body.value).toBe("New direction typed while saving");
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
	click("response-preview");
	submit("response");
	await waitFor(() => expect(page.document.getElementById("response-history")?.textContent).toContain("New direction typed while saving"));
	await waitFor(() => expect(body.value).toBe(""));
});

it.each(["handoff", "response"] as const)("rebinds the %s form after persisted pageshow with the durable draft intact", async (kind) => {
	await open(kind);
	enterField(page, kind === "handoff" ? "recipient" : "author", "local-label");
	const input = enterField(page, kind === "handoff" ? "goal" : "body", "Direction before freezing");
	page.window.dispatchEvent(new page.window.Event("pagehide"));
	page.window.dispatchEvent(Object.assign(new page.window.Event("pageshow"), { persisted: true }));
	expect(input.value).toBe("Direction before freezing");
	click(`${kind}-preview`);
	expect(page.document.getElementById(`${kind}-submit`)?.hasAttribute("disabled")).toBe(false);
	submit(kind);
	await waitFor(() => expect(page.document.getElementById(`${kind}-status`)?.textContent).toContain(kind === "handoff" ? "Prepared:" : "Saved:"));
});

it("puts each questionnaire Schema message on its own unanswered control", async () => {
	notes = folder({ "item.md": questionnaireSource });
	board = await startBoard(notes.root, undefined, undefined, true);
	page = await openPage(board, "/_board/respond?item=investigation.choices&request=direction");
	await waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false));
	enterField(page, "author", "reviewer");
	const choice = page.document.querySelector('input[value="history"]');
	if (!(choice instanceof page.window.HTMLInputElement)) {
		throw new Error("Missing choice");
	}
	choice.checked = true;
	choice.dispatchEvent(new page.window.Event("input", { bubbles: true }));
	click("response-preview");
	const texts = [...page.document.querySelectorAll("[data-answer-text]")];
	const [first, second] = texts;
	if (!(first instanceof page.window.HTMLTextAreaElement && second instanceof page.window.HTMLTextAreaElement)) {
		throw new Error("Missing answer controls");
	}
	expect(first.validationMessage).toBe("");
	expect(second.validationMessage).toBe("Choose an option or answer in your own words.");
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
	second.value = "My own answer";
	second.dispatchEvent(new page.window.Event("input", { bubbles: true }));
	click("response-preview");
	expect(second.validationMessage).toBe("");
	expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
});
