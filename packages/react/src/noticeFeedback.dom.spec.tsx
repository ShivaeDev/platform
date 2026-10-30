import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { formSubmitted, noticeScreen, notifications, refreshFailed, removalHeldAcrossSessionChange } from "#test/notices/story.tsx";

notifications.it(
	"a failed refresh publishes Refresh failed and keeps the shown notes",
	[noticeScreen()],
	function* ({ breakRefresh, notices, rows }) {
		yield* breakRefresh();

		yield* outcomes({
			notices: [notices(), ["Refresh failed"]],
			rows: [rows(), "existing"],
		});
	},
);

notifications.it("rendering again after a failed refresh publishes nothing more", [refreshFailed()], function* ({ notices, renderAgain }) {
	yield* renderAgain();

	expect(yield* notices()).toEqual(["Refresh failed"]);
});

notifications.it("a second failed refresh publishes its own notice", [refreshFailed()], function* ({ notices, refresh }) {
	yield* refresh();

	expect(yield* notices()).toEqual(["Refresh failed", "Refresh failed"]);
});

notifications.it(
	"a completed form submission publishes a notice that offers Undo",
	[formSubmitted("created")],
	function* ({ completeRemove, notice }) {
		yield* completeRemove("created");

		expect(yield* notice("Removed created")).toEqual({ outcome: "", undo: "ready" });
	},
);

notifications.it(
	"a form notice's Undo sends the application's payload",
	[formSubmitted("created")],
	function* ({ completeRemove, restoreCalls, undo }) {
		yield* completeRemove("created");

		yield* undo("created");

		expect(yield* restoreCalls()).toEqual([{ expectedVersion: 8, title: "created" }]);
	},
);

notifications.it(
	"a removal that completes after bob's session replaced alice's publishes nothing",
	[removalHeldAcrossSessionChange()],
	function* ({ completeRemove, notices }) {
		yield* completeRemove("first");

		expect(yield* notices()).toEqual([]);
	},
);

notifications.it(
	"after the session change, bob's own removal publishes its notice",
	[removalHeldAcrossSessionChange()],
	function* ({ completeRemove, notices, remove }) {
		yield* completeRemove("first");
		yield* remove("second");

		yield* completeRemove("second");

		expect(yield* notices()).toEqual(["Removed second"]);
	},
);

notifications.it(
	"an editor save publishes its notice through its submission",
	[noticeScreen({ editor: true })],
	function* ({ completeRemove, notices, saveEditor }) {
		yield* saveEditor();

		yield* completeRemove("existing");

		expect(yield* notices()).toEqual(["Saved existing"]);
	},
);

notifications.it(
	"an editor's failed refresh publishes its query notice and keeps the shown notes",
	[noticeScreen({ editor: true })],
	function* ({ breakRefresh, notices, rows }) {
		yield* breakRefresh();

		yield* outcomes({
			notices: [notices(), ["Editor refresh failed"]],
			rows: [rows(), "existing"],
		});
	},
);
