import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeKeys, watchesList } from "#test/changeKeys.ts";

changeKeys.it(
	"capture reports generated record ids, recorded keys and discarded savepoint keys while the committed record reaches its subscriber",
	[watchesList(1), watchesList(2)],
	function* ({ inTransaction, insertRecord, createdIds, recordedKeys, discardedKeys, publishedKeys, rejects, storedRecords, woken }) {
		yield* inTransaction(function* () {
			yield* insertRecord(1, "alice");
			yield* inTransaction(function* () {
				yield* insertRecord(2, "bob");
				yield* rejects();
			});
		});

		const [alice, bob] = yield* createdIds();
		expect(alice).toEqual(expect.any(Number));
		expect(bob).toEqual(expect.any(Number));
		expect(alice).not.toBe(bob);
		yield* outcomes([
			[
				"recorded keys",
				() => recordedKeys(),
				[
					["the table", `record ${alice}`, "listId 1", 'owner "alice"'],
					["the table", `record ${bob}`, "listId 2", 'owner "bob"'],
				],
			],
			["discarded keys", () => discardedKeys(), [["the table", `record ${bob}`, "listId 2", 'owner "bob"']]],
			["publication attempt", () => publishedKeys(), ["listId 1", 'owner "alice"', `record ${alice}`, "the table"]],
			["subscriber refresh", () => woken(), ["list 1"]],
			["stored records", () => storedRecords(), [`record ${alice} in list 1 for alice`]],
		]);
	},
);
