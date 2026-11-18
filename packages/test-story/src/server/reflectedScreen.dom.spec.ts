import { expect } from "vitest";
import { outcomes } from "#server/outcomes.ts";
import { attempt } from "#test/attempt.ts";
import { reflectedPage, updatesFollowReplies, updatesHeld } from "#test/reflectedPage.ts";

reflectedPage.it(
	"settling after a save waits until the update that follows its reply is on the screen",
	[updatesFollowReplies],
	function* ({ click, enter, settle, shown }) {
		yield* enter("input", "Saved title");

		yield* click({ name: "Save", role: "button" });
		yield* settle();

		expect(yield* shown()).toBe("Saved title");
	},
);

reflectedPage.it("settling after a command that changes nothing returns without an update", [], function* ({ click, settle, shown }) {
	yield* click({ name: "Touch", role: "button" });
	yield* settle();

	expect(yield* shown()).toBe("First page");
});

reflectedPage.it("sync waits until another viewer's save is on the screen", [updatesFollowReplies], function* ({ anotherViewerSaves, shown, sync }) {
	yield* anotherViewerSaves("Another viewer's title");

	yield* sync();

	expect(yield* shown()).toBe("Another viewer's title");
});

reflectedPage.it(
	"a sync the server's held update keeps open dies at its timeout with the screen it left",
	[updatesHeld],
	function* ({ anotherViewerSaves, shown, sync, updateStarted }) {
		yield* anotherViewerSaves("Held title");
		yield* updateStarted();

		yield* outcomes([
			[
				"sync",
				() => attempt(sync({ timeoutMs: 50 })),
				[
					"died: The screen did not sync within 50ms.",
					"help: Release held server work and check that the host serves the client's sync command.",
					"Screen: First pageSaveTouch",
				].join("\n"),
			],
			["shown", () => shown(), "First page"],
		]);
	},
);

reflectedPage.it("a driver without a sync Effect refuses to sync with its typed reason", [], function* ({ syncWithoutSync }) {
	expect(yield* attempt(syncWithoutSync())).toBe(
		[
			"failed with MissingScreenSync: Cannot sync the screen without a sync Effect.",
			"help: Supply sync, an Effect that completes once the screen's live queries show every change committed before it, such as screenSync(client, registry) from @shivaedev/contract/screenSync.ts.",
		].join("\n"),
	);
});
