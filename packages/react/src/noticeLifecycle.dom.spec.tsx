import { expect } from "vitest";
import { noticeScreen, notifications } from "#test/notices/story.tsx";

notifications.it("Independent completions publish independent notices", [noticeScreen()], function* ({ click, complete, observe, snapshot, render }) {
	yield* click("Remove first");
	yield* click("Remove second");
	yield* observe("both commands reach the service", () => expect(snapshot().started).toEqual(["first", "second"]));
	yield* complete("remove", "second");
	yield* observe("second publishes independently", () => expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed second"]));
	yield* complete("remove", "first");
	yield* observe("each completion publishes its descriptor", () =>
		expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed second", "Removed first"]),
	);
	yield* render({ screens: false });
	expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed second", "Removed first"]);
	yield* click("Dismiss Removed second");
	expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed first"]);
});

notifications.it("Undo uses the application's expected version", [noticeScreen()], function* ({ click, complete, observe, snapshot }) {
	yield* click("Remove first");
	yield* observe("remove is held", () => expect(snapshot().started).toEqual(["first"]));
	yield* complete("remove", "first");
	yield* observe("Undo is offered", () => expect(snapshot().notices[0]?.message).toBe("Removed first"));
	yield* click("Undo first");
	yield* observe("Undo receives the exact app payload and disables its control", () => {
		expect(snapshot().calls).toEqual([{ expectedVersion: 8, title: "first" }]);
		expect(snapshot().notices[0]?.pending).toBe(true);
	});
	yield* click("Undo first");
	expect(snapshot().calls).toEqual([{ expectedVersion: 8, title: "first" }]);
	yield* complete("restore", "first");
	yield* observe("the restored row and action outcome reach the screen", () => {
		expect(snapshot().rows).toBe("existing, first@9");
		expect(snapshot().notices[0]).toMatchObject({ outcome: "Restored first", pending: false });
	});
});

notifications.it("Undo conflict stays with its action", [noticeScreen()], function* ({ click, complete, observe, snapshot }) {
	yield* click("Remove first");
	yield* observe("remove is held", () => expect(snapshot().started).toEqual(["first"]));
	yield* complete("remove", "first");
	yield* observe("Undo is offered", () => expect(snapshot().notices[0]?.message).toBe("Removed first"));
	yield* click("Edit first");
	yield* click("Undo first");
	yield* observe("Undo starts", () => expect(snapshot().calls).toEqual([{ expectedVersion: 8, title: "first" }]));
	yield* complete("restore", "first");
	yield* observe("the conflict is rendered on the original action", () => {
		expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed first"]);
		expect(snapshot().notices[0]?.outcome).toContain("Conflict");
		expect(snapshot().notices[0]?.pending).toBe(false);
		expect(snapshot().rows).toBe("existing");
	});
});

notifications.it("Notification teardown releases entries and actions", [noticeScreen()], function* ({ click, complete, observe, snapshot, render }) {
	yield* click("Remove first");
	yield* observe("remove starts", () => expect(snapshot().started).toEqual(["first"]));
	yield* complete("remove", "first");
	yield* observe("notice arrives", () => expect(snapshot().notices[0]?.message).toBe("Removed first"));
	yield* click("Undo first");
	yield* observe("Undo starts", () => expect(snapshot().calls).toEqual([{ expectedVersion: 8, title: "first" }]));
	yield* render({ host: false });
	yield* observe("unmount interrupts the action and releases entries", () => {
		expect(snapshot().released).toEqual(["first"]);
		expect(snapshot().notices).toEqual([]);
	});
	yield* render({ host: true });
	expect(snapshot().notices).toEqual([]);
});

notifications.it("Dismissal releases a pending Undo", [noticeScreen()], function* ({ click, complete, observe, snapshot }) {
	yield* click("Remove first");
	yield* observe("remove starts", () => expect(snapshot().started).toEqual(["first"]));
	yield* complete("remove", "first");
	yield* observe("notice arrives", () => expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed first"]));
	yield* click("Undo first");
	yield* observe("Undo starts", () => expect(snapshot().calls).toEqual([{ expectedVersion: 8, title: "first" }]));
	yield* click("Dismiss Removed first");
	yield* observe("dismissal interrupts Undo", () => {
		expect(snapshot().released).toEqual(["first"]);
		expect(snapshot().notices).toEqual([]);
	});
});

notifications.it("Expiry releases a pending Undo", [noticeScreen({ expiresIn: 500 })], function* ({ click, complete, observe, snapshot }) {
	yield* click("Remove first");
	yield* observe("remove starts", () => expect(snapshot().started).toEqual(["first"]));
	yield* complete("remove", "first");
	yield* observe("notice arrives", () => expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed first"]));
	yield* click("Undo first");
	yield* observe("Undo starts", () => expect(snapshot().calls).toEqual([{ expectedVersion: 8, title: "first" }]));
	yield* observe("expiry removes the notice and interrupts Undo", () => {
		expect(snapshot().released).toEqual(["first"]);
		expect(snapshot().notices).toEqual([]);
	});
});

notifications.it(
	"Session replacement discards a late Undo outcome",
	[noticeScreen({ uninterruptible: true })],
	function* ({ click, complete, observe, snapshot, render }) {
		yield* click("Remove first");
		yield* observe("remove starts", () => expect(snapshot().started).toEqual(["first"]));
		yield* complete("remove", "first");
		yield* observe("notice arrives", () => expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed first"]));
		yield* click("Undo first");
		yield* observe("Undo starts", () => expect(snapshot().calls).toEqual([{ expectedVersion: 8, title: "first" }]));
		yield* render({ session: "bob" });
		expect(snapshot().notices).toEqual([]);
		yield* complete("restore", "first");
		yield* observe("old uninterruptible work settles", () => expect(snapshot().released).toEqual(["first"]));
		expect(snapshot().notices).toEqual([]);
	},
);

notifications.it("Commands run without a notice host", [noticeScreen({ host: false })], function* ({ click, complete, observe, snapshot }) {
	yield* click("Remove first");
	yield* observe("the command reaches the service", () => expect(snapshot().started).toEqual(["first"]));
	yield* complete("remove", "first");
	yield* observe("the command completes without a host", () => expect(snapshot().command).toBe("first"));
	expect(snapshot().notices).toEqual([]);
});

notifications.it(
	"Query, command and form failures publish without screen notice state",
	[noticeScreen({ queryFailure: true })],
	function* ({ click, observe, snapshot, render }) {
		yield* observe("initial query failure is presented", () =>
			expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Initial load failed"]),
		);
		yield* render({ queryFailure: true });
		expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Initial load failed"]);
		yield* click("Remove blocked");
		yield* observe("command failure publishes", () =>
			expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Initial load failed", "Command failed"]),
		);
		yield* click("Submit form");
		yield* observe("form failure publishes through submission", () =>
			expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Initial load failed", "Command failed", "Command failed"]),
		);
	},
);
