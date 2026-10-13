import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { folder, startBoard } from "#test/board.ts";
import { held, openPage } from "#test/browser.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { enterField } from "#test/enterField.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";
import { rpcCall } from "#test/rpc.ts";

it.live("retains and persists newer handoff direction when a preparation finishes", function* () {
	const notes = folder({ "item.md": EDGE_ATTENTION_SOURCE });
	yield* Effect.addFinalizer(() => Effect.sync(() => notes.remove()));
	const board = yield* startBoard(notes.root, undefined, undefined, true);
	const gate = held();
	let reached = false;
	const page = yield* openPage(board, "/_board/handoff?item=item.edge", (window) => {
		const fetch = window.fetch.bind(window);
		window.fetch = async (input, init) => {
			const call = await rpcCall(window, input, init);
			if (call?.tag === "work-board.prepareHandoff") {
				reached = true;
				await gate.gate;
			}
			return fetch(input, init);
		};
	});
	yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("handoff-preview")).toHaveProperty("disabled", false)));
	yield* formEvent(page, () => enterField(page, "recipient", "local-agent"));
	yield* formEvent(page, () => enterField(page, "goal", "First direction"));
	yield* formEvent(page, () =>
		page.document.getElementById("handoff-preview")?.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true })),
	);
	yield* formEvent(page, () =>
		page.document.getElementById("handoff-form")?.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true })),
	);
	try {
		yield* Effect.promise(() => waitFor(() => expect(reached).toBe(true)));
		yield* formEvent(page, () => enterField(page, "goal", "Later direction"));
	} finally {
		gate.release();
	}
	yield* Effect.promise(() =>
		waitFor(() => expect(page.document.getElementById("handoff-status")?.textContent).toContain("Your newer draft remains unsaved")),
	);
	expect(page.document.querySelector('[name="goal"]')).toHaveProperty("value", "Later direction");
	const storage = page.window.localStorage;
	const stored = Array.from({ length: storage.length }, (_, index) => storage.getItem(storage.key(index) ?? ""));
	expect(stored.some((value) => value?.includes("Later direction"))).toBe(true);
});
