import { Effect } from "effect";
import { expect } from "vitest";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { record } from "#test/storage.ts";
import { storage } from "#test/storageStory.ts";

storage.it(
	"a story's record write and a scope finalizer's reservation both land in its rollback transaction",
	[],
	function* ({ insert, reservations, reserveForeign, workIds }) {
		yield* Effect.scoped(Effect.acquireRelease(insert(record("one")), () => Effect.orDie(reserveForeign("finalizer"))));

		yield* outcomes([
			["records", () => workIds(), ["one"]],
			["reservations", () => reservations(), [{ areas: [], backlog: true, executing: true, owner: "finalizer" }]],
		]);
	},
);

storage.it(
	"the next story starts with prepared tables and none of the previous story's records or reservations",
	[],
	function* ({ insert, reload, reservations, workIds }) {
		yield* outcomes([
			["records", () => workIds(), []],
			["reservations", () => reservations(), []],
		]);

		const saved = yield* insert(record("one"));

		expect(yield* reload("one")).toEqual(saved);
	},
);

storage.it(
	"a store opened in an isolated database commits through its own connection and leaves the story's records untouched",
	[],
	function* ({ namespace, openStorage, readCommittedRecord, insert, workIds }) {
		yield* insert(record("outer"));

		const committed = yield* withIsolatedDatabase(
			Effect.gen(function* () {
				const clone = yield* openStorage(namespace);
				const saved = yield* clone.insert(record("committed"));
				return { readBack: yield* readCommittedRecord(namespace, "committed"), saved };
			}),
		);

		expect(committed.readBack).toEqual(committed.saved);
		expect(yield* workIds()).toEqual(["outer"]);
	},
);
