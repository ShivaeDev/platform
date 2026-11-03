import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { transact } from "@shivaedev/sql/transact.ts";
import { record } from "#test/storage.ts";
import { isolatedStorage } from "#test/storageStory.ts";

isolatedStorage.it(
	"each record and foreign reservation write announces its change keys when it commits",
	[],
	function* ({ committedChanges, namespace, insert, replace, reserveForeign, releaseForeign }) {
		const changes = yield* committedChanges(
			Effect.gen(function* () {
				const saved = yield* insert(record("one"));
				yield* replace("one", saved.version, { ...saved.value, step: "running" });
				yield* reserveForeign("external");
				yield* reserveForeign("external", { backlog: true, executing: false });
				yield* releaseForeign("external");
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

isolatedStorage.it("a rolled-back record write announces no change keys", [], function* ({ committedChanges, stepOf, insert }) {
	const changes = yield* committedChanges(
		Effect.gen(function* () {
			const rollback = yield* transact(insert(record("one")).pipe(Effect.andThen(Effect.fail("rollback"))), { onSqlError: (error) => error }).pipe(
				Effect.flip,
			);
			expect(rollback).toBe("rollback");
		}),
	);

	expect(changes).toEqual([]);
	expect(yield* stepOf("one")).toBe("missing");
});
