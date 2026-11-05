import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { potStored, sharedRepositories } from "#test/sharedRepositories.ts";

sharedRepositories.it(
	"plates and pot lifecycle use one repository's load and settle operations on PostgreSQL",
	[potStored()],
	function* ({ addPortion, loadPot, repositoryBuilds, repositoryIsShared, settlePot }) {
		expect(yield* loadPot()).toMatchObject({ amount: 10, pending: 2 });

		yield* addPortion(3);
		yield* settlePot();

		yield* outcomes([
			["pot returned by plates", () => loadPot(), { amount: 15, id: 1, pending: 0 }],
			["repository constructions", () => repositoryBuilds(), 1],
			["environment holds the constructed repository", () => repositoryIsShared(), true],
		]);
	},
);

sharedRepositories.it(
	"a transaction commits both services' writes through their shared PostgreSQL repository",
	[potStored()],
	function* ({ addPortion, inTransaction, loadPot, settlePot, storedPot }) {
		yield* inTransaction(
			Effect.gen(function* () {
				yield* addPortion(3);
				yield* settlePot();
				expect(yield* loadPot()).toMatchObject({ amount: 15, pending: 0 });
			}),
		);

		expect(yield* storedPot()).toEqual([{ amount: 15, pending: 0 }]);
	},
);

sharedRepositories.it(
	"a failed transaction rolls back both services' writes through their shared PostgreSQL repository",
	[potStored()],
	function* ({ addPortion, loadPot, settlePot, storedPot, transactionEnding }) {
		const ending = yield* transactionEnding(
			Effect.gen(function* () {
				yield* addPortion(3);
				yield* settlePot();
				expect(yield* loadPot()).toMatchObject({ amount: 15, pending: 0 });
				return yield* Effect.fail("cancelled");
			}),
		);

		expect(ending).toBe("failed with cancelled");
		expect(yield* storedPot()).toEqual([{ amount: 10, pending: 2 }]);
	},
);

sharedRepositories.it(
	"a failed settle savepoint retains the outer plates write in the shared PostgreSQL transaction",
	[potStored()],
	function* ({ addPortion, inTransaction, loadPot, settlePot, storedPot, transactionEnding }) {
		yield* inTransaction(
			Effect.gen(function* () {
				yield* addPortion(3);
				const ending = yield* transactionEnding(Effect.andThen(settlePot(), Effect.fail("cancelled")));
				expect(ending).toBe("failed with cancelled");
				expect(yield* loadPot()).toMatchObject({ amount: 10, pending: 5 });
			}),
		);

		expect(yield* storedPot()).toEqual([{ amount: 10, pending: 5 }]);
	},
);

sharedRepositories.it(
	"the shared repository's scoped table survives service calls and is released when its Layer closes",
	[potStored()],
	function* ({ closeRepositories, loadPot, settlePot, tableExists }) {
		yield* settlePot();
		yield* outcomes([
			["pot returned by plates", () => loadPot(), { amount: 12, pending: 0 }],
			["repository table exists", () => tableExists(), true],
		]);

		yield* closeRepositories();

		expect(yield* tableExists()).toBe(false);
	},
);
