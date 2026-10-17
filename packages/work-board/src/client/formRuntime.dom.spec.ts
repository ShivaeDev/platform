import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { folder, startBoard } from "#test/board.ts";
import { openPage } from "#test/browser.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { enterField } from "#test/enterField.ts";
import { silentWatch } from "#test/faults.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";
import { type RpcRequest, rpcCall } from "#test/rpc.ts";

const cases = (["response", "handoff"] as const).flatMap((kind) => (["rejection", "transport"] as const).map((failure) => ({ failure, kind })));
it.live.each(cases)("classifies $kind $failure and retries its retained identity through RPC", function* ({ failure, kind }) {
	const notes = folder({ "item.md": EDGE_ATTENTION_SOURCE });
	yield* Effect.addFinalizer(() => Effect.sync(() => notes.remove()));
	const board = yield* startBoard(notes.root, undefined, silentWatch, true);
	const commands: RpcRequest[] = [];
	let offline = failure === "transport";
	const command = kind === "response" ? "work-board.recordResponse" : "work-board.prepareHandoff";
	const page = yield* openPage(
		board,
		kind === "response" ? "/_board/respond?item=item.edge&request=direction" : "/_board/handoff?item=item.edge",
		(window) => {
			const fetch = window.fetch.bind(window);
			window.fetch = async (input, init) => {
				const call = await rpcCall(window, input, init);
				if (call?.tag === command) {
					commands.push(call);
					if (offline) {
						throw new Error("Connection lost while saving");
					}
				}
				return fetch(input, init);
			};
		},
	);
	function click(id: string) {
		page.document.getElementById(`${kind}-${id}`)?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true }));
	}
	function submit() {
		page.document.getElementById(`${kind}-form`)?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
	}
	yield* formEvent(page, () => enterField(page, kind === "response" ? "author" : "recipient", "local-reviewer"));
	const field = enterField(page, kind === "response" ? "body" : "goal", "Keep this direction");
	yield* formEvent(page, () => click("preview"));
	const identity = page.document.getElementById(`${kind}-preview-content`)?.textContent?.match(/\b(?:response|handoff)\.[\da-f-]{36}/u)?.[0];
	expect(identity).toBeDefined();
	if (failure === "rejection") {
		notes.write("item.md", `${EDGE_ATTENTION_SOURCE}Changed reviewed source.\n`);
	}
	yield* formEvent(page, submit);
	function status() {
		return page.document.getElementById(`${kind}-status`)?.textContent;
	}
	yield* Effect.promise(() => waitFor(() => expect(status()).toContain(failure === "rejection" ? "Rejected: PreconditionFailed:" : "Uncertain:")));
	expect(status()).toContain("Draft retained");
	expect(field.value).toBe("Keep this direction");
	notes.write("item.md", EDGE_ATTENTION_SOURCE);
	offline = false;
	yield* formEvent(page, () => click("preview"));
	yield* formEvent(page, submit);
	yield* Effect.promise(() => waitFor(() => expect(status()).toContain(kind === "response" ? "Saved:" : "Prepared:")));
	expect(commands.length).toBe(failure === "transport" || kind === "handoff" ? 2 : 1);
	for (const call of commands) {
		expect(call.payload).toMatchObject({ id: identity });
	}
});
