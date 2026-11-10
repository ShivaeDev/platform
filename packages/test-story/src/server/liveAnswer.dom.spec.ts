import { expect } from "vitest";
import { attempt } from "#test/attempt.ts";
import { rerunsAfterReceipt, savesPublishNoChange, settlingPage } from "#test/settlingPage.tsx";

settlingPage.it(
	"a save waits for the live answer that arrives after its receipt before the screen reads the title",
	[rerunsAfterReceipt],
	function* ({ enter, save, settle, text }) {
		yield* settle();
		yield* enter("input", "Saved title");

		yield* save();
		yield* settle();

		expect(text("output")).toBe("Saved title");
	},
);

settlingPage.it(
	"a save the server never publishes says that no live answer arrived",
	[savesPublishNoChange],
	function* ({ enter, save, settle, text }) {
		yield* settle();
		yield* enter("input", "Unpublished title");

		expect(yield* attempt(save({ timeoutMs: 50 }))).toBe(
			[
				"failed with SignalNotReceived: Waited for a live answer to page 1 after the action above, none arrived: nothing came within 50ms.",
				"help: the server pushed no result for this query after the action. Check that the action changes what the query",
				"      reads, or settle without this wait when the command's own reply updates the screen.",
			].join("\n"),
		);
		expect(text("output")).toBe("First page");
	},
);
