import { expect } from "vitest";
import { noticeScreen, notifications } from "#test/notices/story.tsx";

notifications.it("A refresh failure publishes once and retains the visible data", [noticeScreen()], function* ({ click, observe, snapshot, render }) {
	yield* observe("initial query completes", () => expect(snapshot().rows).toBe("existing"));
	yield* click("Break refresh");
	yield* observe("refresh failure publishes its wording", () =>
		expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Refresh failed"]),
	);
	yield* render({ queryFailure: false });
	expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Refresh failed"]);
	expect(snapshot().rows).toBe("existing");
	yield* click("Refresh");
	yield* observe("a separate failed refresh publishes independently", () =>
		expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Refresh failed", "Refresh failed"]),
	);
});

notifications.it("A successful form submission can offer Undo", [noticeScreen()], function* ({ type, click, complete, observe, snapshot }) {
	yield* type("created");
	yield* click("Submit form");
	yield* observe("the form submits decoded values", () => expect(snapshot().started).toEqual(["created"]));
	yield* complete("remove", "created");
	yield* observe("the form publishes a notice", () => expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed created"]));
	yield* click("Undo created");
	yield* observe("form Undo uses the application's payload", () => expect(snapshot().calls).toEqual([{ expectedVersion: 8, title: "created" }]));
	yield* complete("restore", "created");
	yield* observe("form Undo completes on its action", () => expect(snapshot().notices[0]?.outcome).toBe("Restored created"));
});

notifications.it(
	"Session replacement discards a late command descriptor",
	[noticeScreen()],
	function* ({ click, complete, observe, snapshot, render }) {
		yield* click("Remove first");
		yield* observe("remove starts", () => expect(snapshot().started).toEqual(["first"]));
		yield* render({ session: "bob" });
		yield* complete("remove", "first");
		expect(snapshot().notices).toEqual([]);
		yield* click("Remove second");
		yield* observe("the new session runs commands", () => expect(snapshot().started).toEqual(["first", "second"]));
		yield* complete("remove", "second");
		yield* observe("the new session publishes its own descriptor", () =>
			expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed second"]),
		);
	},
);

notifications.it(
	"Editor saves publish through their submission Effect",
	[noticeScreen({ editor: true })],
	function* ({ click, complete, observe, snapshot }) {
		yield* click("Save editor");
		yield* observe("the editor submits its row", () => expect(snapshot().started).toEqual(["existing"]));
		yield* complete("remove", "existing");
		yield* observe("the editor publishes its completion", () =>
			expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Saved existing"]),
		);
	},
);

notifications.it(
	"Editor query failures publish without another query hook",
	[noticeScreen({ editor: true })],
	function* ({ click, observe, snapshot }) {
		yield* observe("the editor query completes", () => expect(snapshot().rows).toBe("existing"));
		yield* click("Break refresh");
		yield* observe("the editor publishes its query failure", () =>
			expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Editor refresh failed"]),
		);
		expect(snapshot().rows).toBe("existing");
	},
);
