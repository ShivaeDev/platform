import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "#client/testing.ts";
import { automatic } from "#test/automatic/automatic.ts";

expectNoReactWarnings();

automatic.it("mounts queries from two contracts without restarting their tab's socket or rereading another query", [], function* (test) {
	yield* eventually(() => {
		expect(test.ready()).toBe(true);
		expect(test.note(2)).toBe("Second");
	});
	expect(test.reads().toSorted()).toEqual([1, 2]);
	expect(test.connections()).toEqual([test.socketUrl()]);
	yield* test.toggleSecond(false);
	const before = test.reads().filter((id) => id === 1);
	yield* test.remoteRename(2, "While unmounted");
	yield* test.settle();
	expect(test.reads().toSorted()).toEqual([1, 2]);
	yield* test.toggleSecond(true);
	yield* eventually(() => expect(test.note(2)).toBe("While unmounted"));
	expect(test.reads().filter((id) => id === 1)).toEqual(before);
	expect(test.connections()).toEqual([test.socketUrl()]);
	yield* test.screenRename("From this tab");
	yield* eventually(() => expect(test.note(1)).toBe("From this tab"));
	expect(test.connections()).toEqual([test.socketUrl()]);
});

automatic.it("a second host's write refreshes only the affected query and equal results retain their atom", [], function* (test) {
	yield* eventually(() => {
		expect(test.ready()).toBe(true);
		expect(test.note(2)).toBe("Second");
	});
	const secondReads = test.reads().filter((id) => id === 2);
	yield* test.remoteRename(1, "From another host");
	yield* eventually(() => expect(test.note(1)).toBe("From another host"));
	expect(test.reads().filter((id) => id === 2)).toEqual(secondReads);
	const previous = test.query(1);
	const before = test.reads();
	yield* test.remoteRename(1, "From another host");
	yield* eventually(() => expect(test.reads()).toEqual([...before, 1]));
	yield* test.settle();
	expect(test.query(1)).toBe(previous);
});

automatic.it("shows reconnection and reads current values after missing a committed change", [], function* (test) {
	yield* eventually(() => {
		expect(test.ready()).toBe(true);
		expect(test.note(2)).toBe("Second");
	});
	yield* test.toggleSecond(false);
	const before = test.reads();
	yield* test.drop();
	yield* eventually(() => expect(test.connection()).toBe("Reconnecting"));
	yield* test.remoteRename(1, "Changed while disconnected");
	yield* eventually(() => {
		expect(test.connection()).toBe("live");
		expect(test.note(1)).toBe("Changed while disconnected");
	});
	expect(test.reads()).toEqual([...before, 1]);
	expect(test.connections()).toEqual([test.socketUrl(), test.socketUrl()]);
});

automatic.it("rapid commits coalesce into one authorized read of the latest value", [], function* (test) {
	yield* eventually(() => {
		expect(test.ready()).toBe(true);
		expect(test.note(2)).toBe("Second");
	});
	test.coalesce(1, 300);
	const before = test.reads();
	for (const title of ["First change", "Second change", "Latest change"]) {
		yield* test.remoteRename(1, title);
	}
	yield* eventually(() => expect(test.note(1)).toBe("Latest change"));
	expect(test.reads()).toEqual([...before, 1]);
	expect(test.note(2)).toBe("Second");
});
