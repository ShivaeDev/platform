import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { transact } from "@shivaedev/sql/transact.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { record } from "#test/storage.ts";
import { storage } from "#test/storageStory.ts";

storage.it("an unchanged second list decodes no records again", [], function* ({ decodedOnList, insert }) {
	yield* insert(record("one"));
	yield* insert(record("two"));
	expect(yield* decodedOnList()).toBe("decoded records");

	const decodes = yield* decodedOnList();

	expect(decodes).toBe("decoded nothing");
});

storage.it(
	"a list after another writer changes one record rereads it and returns its new version",
	[],
	function* ({ decodedOnList, namespace, openStorage, insert, records }) {
		yield* insert(record("one"));
		const two = yield* insert(record("two"));
		yield* decodedOnList();
		const other = yield* openStorage(namespace);

		const running = yield* other.replace("two", two.version, { ...two.value, step: "running" });

		yield* outcomes([
			["record decodes", () => decodedOnList(), "decoded records"],
			["listed steps", () => records().pipe(Effect.map((entries) => entries.map(({ value }) => value.step))), ["queued", "running"]],
			["listed second record", () => records().pipe(Effect.map((entries) => entries[1])), running],
		]);
	},
);

storage.it(
	"a list read inside a rolled-back write never serves that write after another writer commits the same version",
	[],
	function* ({ namespace, openStorage, insert, replace, records }) {
		const one = yield* insert(record("one"));
		const rollback = yield* transact(
			Effect.gen(function* () {
				yield* replace("one", one.version, { ...one.value, step: "running" });
				yield* records();
				return yield* Effect.fail("roll back");
			}),
			{ onSqlError: (error) => error },
		).pipe(Effect.flip);

		expect(rollback).toBe("roll back");

		const terminal = yield* (yield* openStorage(namespace)).replace("one", one.version, { ...one.value, step: "terminal" });

		expect(yield* records()).toEqual([terminal]);
	},
);
