import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { collection } from "@shivaedev/changes/keys.ts";
import { eventually } from "#test/eventually.ts";
import { liveNotesStory, liveSession, resyncingKeys } from "#test/liveNotesStory.ts";
import { notes } from "#test/notes.ts";

const lines = collection("lines", Schema.Number);
const orders = collection("orders", Schema.Number);

liveNotesStory.it("collection-wide changes name subscribed items and leave lists precise", [liveSession()], function* ({ watchKeys, invalidate }) {
	const hints: unknown[] = [];
	yield* watchKeys([lines.item(5), lines.list, orders.item(5)], hints).pipe(Effect.forkScoped);
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }]));
	yield* invalidate(["orders:*"]);
	yield* eventually(() => expect(hints).toEqual([{ _tag: "Resync" }, { _tag: "Changed", keys: [orders.item(5)] }]));
	yield* invalidate(["lines:*"]);
	yield* eventually(() =>
		expect(hints).toEqual([{ _tag: "Resync" }, { _tag: "Changed", keys: [orders.item(5)] }, { _tag: "Changed", keys: [lines.item(5)] }]),
	);
	yield* invalidate(["lines"]);
	yield* eventually(() =>
		expect(hints).toEqual([
			{ _tag: "Resync" },
			{ _tag: "Changed", keys: [orders.item(5)] },
			{ _tag: "Changed", keys: [lines.item(5)] },
			{ _tag: "Changed", keys: [lines.list] },
		]),
	);
});

liveNotesStory.it(
	"reconciliation keeps its explicit item scope when reads also register a wildcard",
	[liveSession(), resyncingKeys([notes.item(1)])],
	function* (test) {
		test.mount(test.one);
		test.mount(test.two);
		yield* eventually(() => {
			expect(test.body(test.one)).toBe("First");
			expect(test.body(test.two)).toBe("Second");
		});
		const before = test.reads().filter((read) => read === "get:2").length;
		const readsAfterConnect = test.reads().filter((read) => read === "get:1").length + 1;
		test.connect();
		yield* eventually(() => {
			expect(test.status().connection).toBe("live");
			expect(test.reads().filter((read) => read === "get:1")).toHaveLength(readsAfterConnect);
			expect(test.registry.get(test.one).waiting).toBe(false);
		});
		expect(test.reads().filter((read) => read === "get:2")).toHaveLength(before);
		test.pause(true);
		test.pause(false);
		const readsAfterResume = readsAfterConnect + 1;
		yield* eventually(() => {
			expect(test.reads().filter((read) => read === "get:1")).toHaveLength(readsAfterResume);
			expect(test.registry.get(test.one).waiting).toBe(false);
		});
		expect(test.reads().filter((read) => read === "get:2")).toHaveLength(before);
	},
);
