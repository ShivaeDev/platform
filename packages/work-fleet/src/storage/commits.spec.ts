import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { record } from "#test/storage.ts";
import { isolatedStorage } from "#test/storageStory.ts";

isolatedStorage.it(
	"each record and foreign reservation write announces its change keys when it commits",
	[],
	function* ({ committedChanges, namespace, store }) {
		const changes = yield* committedChanges(
			Effect.gen(function* () {
				const saved = yield* store.insert(record("one"));
				yield* store.compareAndSet("one", saved.version, { ...saved.value, step: "running" });
				yield* store.reserveForeign("external");
				yield* store.reserveForeign("external", { backlog: true, executing: false });
				yield* store.releaseForeign("external");
			}),
		);

		const records = `${namespace}_records`;
		const reservations = `${namespace}_foreign_reservations`;
		expect(changes).toEqual([
			[records, `${records}:one`, "fleet:one", "fleet"],
			[records, `${records}:one`, "fleet:one", "fleet"],
			[reservations, `${reservations}:external`, "fleet"],
			[reservations, `${reservations}:external`, "fleet"],
			[reservations, `${reservations}:external`, "fleet"],
		]);
	},
);

isolatedStorage.it("a rolled-back record write announces no change keys", [], function* ({ rolledBackChanges, stepOf, store }) {
	const changes = yield* rolledBackChanges(store.insert(record("one")));

	expect(changes).toEqual([]);
	expect(yield* stepOf("one")).toBe("missing");
});
