import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, readerAt, responsesEnabled } from "#test/boardStory.ts";
import { held, type openPage } from "#test/browser.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { enterField } from "#test/enterField.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import type { BoardReader } from "#test/readerVerbs.ts";
import { rpcCall } from "#test/rpc.ts";

function* open(reader: BoardReader, kind: "handoff" | "response", beforeScripts?: Parameters<typeof openPage>[2]) {
	const page = yield* reader.open(
		kind === "handoff" ? "/_board/handoff?item=item.edge" : "/_board/respond?item=item.edge&request=direction",
		beforeScripts,
	);
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById(`${kind}-preview`)?.hasAttribute("disabled")).toBe(false)));
	return page;
}

boardStory.it(
	"shows Schema field messages for handoff direction and clears them when corrected",
	[readerAt("/"), projectFiles({ "item.md": EDGE_ATTENTION_SOURCE }), responsesEnabled()],
	function* ({ reader }) {
		const page = yield* open(reader, "handoff");
		yield* formEvent(page, () => enterField(page, "recipient", "agent-local"));
		const goal = enterField(page, "goal", " ");
		yield* formEvent(page, () => reader.click("handoff-preview"));
		expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(true);
		expect(goal.validationMessage).toContain("RegExp");
		yield* formEvent(page, () => enterField(page, "goal", "Review the direction"));
		const recipient = enterField(page, "recipient", "x".repeat(201));
		yield* formEvent(page, () => reader.click("handoff-preview"));
		expect(goal.validationMessage).toBe("");
		expect(recipient.validationMessage).toContain("200");
		expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(true);
		yield* formEvent(page, () => enterField(page, "recipient", "agent-local"));
		yield* formEvent(page, () => reader.click("handoff-preview"));
		expect(recipient.validationMessage).toBe("");
		expect(page.document.getElementById("handoff-submit")?.hasAttribute("disabled")).toBe(false);
	},
);

boardStory.it(
	"saves the captured response while retaining and resubmitting input typed during the command",
	[readerAt("/"), projectFiles({ "item.md": EDGE_ATTENTION_SOURCE }), responsesEnabled()],
	function* ({ reader }) {
		const gate = held();
		let reached = false;
		const page = yield* open(reader, "response", (window) => {
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
		yield* formEvent(page, () => reader.click("response-preview"));
		yield* reader.submit("response-form");
		try {
			yield* Effect.promise(() => waitFor(() => expect(reached).toBe(true)));
			yield* formEvent(page, () => enterField(page, "body", "New direction typed while saving"));
			expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(true);
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
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-preview")).toHaveProperty("disabled", false)));
		yield* formEvent(page, () => reader.click("response-preview"));
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-submit")).toHaveProperty("disabled", false)));
		yield* reader.submit("response-form");
		yield* Effect.promise(() =>
			waitFor(() => expect(page.document.getElementById("response-history")?.textContent).toContain("New direction typed while saving")),
		);
		yield* Effect.promise(() => waitFor(() => expect(body.value).toBe("")));
	},
);

for (const kind of ["handoff", "response"] as const) {
	boardStory.it(
		`retains the ${kind} form after persisted pageshow with the durable draft intact`,
		[readerAt("/"), projectFiles({ "item.md": EDGE_ATTENTION_SOURCE }), responsesEnabled()],
		function* ({ reader }) {
			const page = yield* open(reader, kind);
			yield* formEvent(page, () => enterField(page, kind === "handoff" ? "recipient" : "author", "local-label"));
			yield* formEvent(page, () => enterField(page, kind === "handoff" ? "goal" : "body", "Direction before freezing"));
			yield* formEvent(page, () => page.window.dispatchEvent(new page.window.Event("pagehide")));
			yield* formEvent(page, () => page.window.dispatchEvent(Object.assign(new page.window.Event("pageshow"), { persisted: true })));
			yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById(`${kind}-preview`)).not.toBeNull()));
			expect(page.document.querySelector(kind === "handoff" ? '[name="goal"]' : '[name="body"]')).toHaveProperty(
				"value",
				"Direction before freezing",
			);
			yield* formEvent(page, () => reader.click(`${kind}-preview`));
			expect(page.document.getElementById(`${kind}-submit`)?.hasAttribute("disabled")).toBe(false);
			yield* reader.submit(`${kind}-form`);
			yield* Effect.promise(() =>
				waitFor(() => expect(page.document.getElementById(`${kind}-status`)?.textContent).toContain(kind === "handoff" ? "Prepared:" : "Saved:")),
			);
		},
	);
}

boardStory.it(
	"puts each questionnaire Schema message on its own unanswered control",
	[readerAt("/"), projectFiles({ "item.md": questionnaireSource }), responsesEnabled(true)],
	function* ({ reader }) {
		const page = yield* reader.open("/_board/respond?item=investigation.choices&request=direction");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("response-preview")?.hasAttribute("disabled")).toBe(false)));
		yield* formEvent(page, () => enterField(page, "author", "reviewer"));
		yield* reader.chooseOption("history");
		yield* formEvent(page, () => reader.click("response-preview"));
		const texts = [...page.document.querySelectorAll("[data-answer-text]")];
		const [first, second] = texts;
		if (!(first instanceof page.window.HTMLTextAreaElement && second instanceof page.window.HTMLTextAreaElement)) {
			throw new Error("Missing answer controls");
		}
		expect(first.validationMessage).toBe("");
		expect(second.validationMessage).toBe("");
		yield* reader.submit("response-form");
		expect(second.validationMessage).toBe("Choose an option or answer in your own words.");
		expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
		second.value = "My own answer";
		yield* formEvent(page, () => second.dispatchEvent(new page.window.Event("input", { bubbles: true })));
		yield* formEvent(page, () => reader.click("response-preview"));
		expect(second.validationMessage).toBe("");
		expect(page.document.getElementById("response-submit")?.hasAttribute("disabled")).toBe(false);
	},
);
