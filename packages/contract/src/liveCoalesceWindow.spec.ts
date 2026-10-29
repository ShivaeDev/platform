import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import { liveNotesStory, liveSession, watchingNotes } from "#test/liveNotesStory.ts";

liveNotesStory.it("a changed hint refetches when the default 20 ms window closes", [liveSession(), watchingNotes()], function* (test) {
	yield* eventually(() => {
		expect(test.status()).toMatchObject({ connection: "live", needsResync: false });
		expect(test.body(test.one)).toBe("First");
		expect([test.registry.get(test.one).waiting, test.registry.get(test.two).waiting, test.registry.get(test.list).waiting]).toEqual([
			false,
			false,
			false,
		]);
	});
	const before = test.reads();
	yield* test.holdTimers();
	yield* test.edit(1, "Changed");
	yield* test.receivedChanges(1);
	yield* test.advanceTimersBy(19);
	expect(test.reads()).toEqual(before);
	expect(test.registry.get(test.one).waiting).toBe(false);
	expect(test.body(test.one)).toBe("First");
	yield* test.advanceTimersBy(1);
	test.releaseTimers();
	yield* eventually(() => expect(test.body(test.one)).toBe("Changed"));
	expect(test.reads().slice(before.length).sort()).toEqual(["get:1", "list"]);
});
