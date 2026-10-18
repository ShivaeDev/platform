import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { held } from "#test/browser.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { enterField } from "#test/enterField.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";
import { rpcCall } from "#test/rpc.ts";

boardStory.it(
	"retains and persists newer handoff direction when a preparation finishes",
	[projectFiles({ "item.md": EDGE_ATTENTION_SOURCE }), responsesEnabled(true)],
	function* ({ reader }) {
		const gate = held();
		let reached = false;
		const page = yield* reader.open("/_board/handoff?item=item.edge", (window) => {
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
		yield* formEvent(page, () => reader.click("handoff-preview"));
		yield* reader.submit("handoff-form");
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
	},
);
