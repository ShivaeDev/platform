import { expect } from "vitest";
import { adminPage, collectionStory, memberPolicy } from "#test/collectionStory.ts";

collectionStory.it(
	"an admin's collection query refreshes for generated-id inserts in two tenants",
	[adminPage],
	function* ({ insert, shown, untilRefreshed }) {
		expect(yield* shown()).toEqual([]);

		yield* insert("tenant one", "One");
		yield* untilRefreshed();

		expect(yield* shown()).toEqual(["tenant one: One"]);

		yield* insert("tenant two", "Two");
		yield* untilRefreshed();

		expect(yield* shown()).toEqual(["tenant one: One", "tenant two: Two"]);
	},
);

collectionStory.it(
	"an admin's collection query refreshes for updates and deletes",
	[adminPage],
	function* ({ delete: remove, insert, shown, untilRefreshed, update }) {
		const workspace = yield* insert("tenant one", "One");
		yield* untilRefreshed();
		expect(yield* shown()).toEqual(["tenant one: One"]);

		yield* update(workspace.id, "tenant two", "Renamed");
		yield* untilRefreshed();

		expect(yield* shown()).toEqual(["tenant two: Renamed"]);

		yield* remove(workspace.id);
		yield* untilRefreshed();

		expect(yield* shown()).toEqual([]);
	},
);

collectionStory.it(
	"an admin's collection query refreshes for inserted and conflicting upserts",
	[adminPage],
	function* ({ shown, untilRefreshed, upsert }) {
		expect(yield* shown()).toEqual([]);

		yield* upsert("tenant one", "One");
		yield* untilRefreshed();

		expect(yield* shown()).toEqual(["tenant one: One"]);

		yield* upsert("tenant two", "One");
		yield* untilRefreshed();

		expect(yield* shown()).toEqual(["tenant two: One"]);
	},
);

collectionStory.it(
	"an admin's collection query refreshes for bulk inserts and bulk upserts across tenants",
	[adminPage],
	function* ({ insertMany, shown, untilRefreshed, upsertMany }) {
		expect(yield* shown()).toEqual([]);

		yield* insertMany([
			{ tenant: "tenant one", title: "One" },
			{ tenant: "tenant two", title: "Two" },
		]);
		yield* untilRefreshed();

		expect(yield* shown()).toEqual(["tenant one: One", "tenant two: Two"]);

		yield* upsertMany([
			{ tenant: "tenant two", title: "One" },
			{ tenant: "tenant one", title: "Two" },
		]);
		yield* untilRefreshed();

		expect(yield* shown()).toEqual(["tenant two: One", "tenant one: Two"]);
	},
);

collectionStory.it("a member without the admin permission cannot subscribe to the collection query", [], function* ({ memberSubscribes }) {
	expect(yield* memberSubscribes()).toBe("failed with read denied");
});

collectionStory.it(
	"losing the admin permission denies the mounted collection query on its next change",
	[adminPage],
	function* ({ insert, revokePermission, shown, untilRefreshed }) {
		expect(yield* shown()).toEqual([]);
		yield* revokePermission();

		yield* insert("tenant two", "Two");
		yield* untilRefreshed();

		expect(yield* shown()).toBe("failed with read denied");
	},
);

collectionStory.it("an untyped member query cannot subscribe to collection-wide changes", [memberPolicy], function* ({ memberSubscribes }) {
	expect(yield* memberSubscribes()).toBe("failed with read denied");
});

collectionStory.it("an untyped member query cannot read the collection", [memberPolicy], function* ({ memberReads }) {
	expect(yield* memberReads()).toBe("failed with read denied");
});
