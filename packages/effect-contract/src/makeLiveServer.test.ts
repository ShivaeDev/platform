import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import { liveNotesStory, liveSession } from "#test/liveNotesStory.ts";
import { notes } from "#test/notes.ts";

liveNotesStory.it("committed keys wake matching streams, and resync wakes every stream", [liveSession()], function* (test) {
	const first: unknown[] = [];
	const second: unknown[] = [];
	yield* test.watch(1, "first", first).pipe(Effect.forkScoped);
	yield* test.watch(2, "first", second).pipe(Effect.forkScoped);
	yield* eventually(() => {
		expect(first).toEqual([{ _tag: "Resync" }]);
		expect(second).toEqual([{ _tag: "Resync" }]);
	});
	yield* test.invalidate(["notes:1"]);
	yield* eventually(() => expect(first).toEqual([{ _tag: "Resync" }, { _tag: "Changed", keys: [notes.item(1)] }]));
	expect(second).toEqual([{ _tag: "Resync" }]);
	yield* test.resync();
	yield* eventually(() => {
		expect(first).toHaveLength(3);
		expect(second).toHaveLength(2);
	});
	expect(first.at(-1)).toEqual({ _tag: "Resync" });
	expect(second.at(-1)).toEqual({ _tag: "Resync" });
});

liveNotesStory.it("resync belongs to its helper when independent helpers share Reactivity", [liveSession()], function* (test) {
	const first: unknown[] = [];
	const second: unknown[] = [];
	yield* test.watch(1, "first", first).pipe(Effect.forkScoped);
	yield* test.watch(2, "second", second).pipe(Effect.forkScoped);
	yield* eventually(() => {
		expect(first).toHaveLength(1);
		expect(second).toHaveLength(1);
	});
	yield* test.resync("first");
	yield* eventually(() => expect(first).toEqual([{ _tag: "Resync" }, { _tag: "Resync" }]));
	expect(second).toEqual([{ _tag: "Resync" }]);
	yield* test.resync("second");
	yield* eventually(() => expect(second).toEqual([{ _tag: "Resync" }, { _tag: "Resync" }]));
});

liveNotesStory.it("a subscription forwards only its keys that actually changed", [liveSession()], function* ({ watchKeys, invalidate }) {
	const hints: unknown[] = [];
	yield* watchKeys([notes.item(1), notes.item(2)], hints).pipe(Effect.forkScoped);
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }]));
	yield* invalidate(["notes:1", "notes:3"]);
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }, { _tag: "Changed", keys: [notes.item(1)] }]));
});
