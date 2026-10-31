import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { type AccountColumn, accountExists, conflicts } from "#test/conflicts.ts";

const one = { amount: 52, email: "one@example.test", origin: "import" };
const retry = { amount: 99, email: "retry@example.test", origin: "retry" };

conflicts.it(
	"insertOrIgnore of a new account returns it with its database-generated id and creation date",
	[],
	function* ({ insertAccountOrIgnore, returned }) {
		yield* insertAccountOrIgnore("one", one);

		expect(yield* returned()).toEqual([{ ...one, createdAt: "a database-generated date", externalKey: "one", id: 1 }]);
	},
);

conflicts.it(
	"insertOrIgnore of an account whose prefixed external key is taken is ignored and keeps the stored account",
	[accountExists("one", one)],
	function* ({ insertAccountOrIgnore, returned, storedAccounts }) {
		yield* insertAccountOrIgnore("one", retry);

		yield* outcomes({
			"returned value": [returned(), ["ignored"]],
			"stored accounts": [storedAccounts(), [{ amount: "52", externalKey: "prefix:one", origin: "import" }]],
		});
	},
);

conflicts.it(
	"upsert of an account whose external key is taken updates only the listed amount and returns the updated account",
	[accountExists("one", one)],
	function* ({ account, returned, upsertAccount }) {
		yield* upsertAccount("one", retry);

		const updated = { ...one, amount: 99, createdAt: "a database-generated date", externalKey: "one", id: 1 };
		yield* outcomes({
			"returned value": [returned(), [{ inserted: false, row: updated }]],
			"stored account": [account(), updated],
		});
	},
);

for (const write of ["insertOrIgnore", "upsert"] as const) {
	conflicts.it(
		`${write} of a new external key with a taken email fails with a unique violation instead of being ignored`,
		[accountExists("one", one)],
		function* ({ endings, insertAccountOrIgnore, upsertAccount }) {
			yield* write === "upsert" ? upsertAccount("two", one) : insertAccountOrIgnore("two", one);

			expect(yield* endings()).toEqual(["failed with a unique violation (SQLSTATE 23505)"]);
		},
	);

	conflicts.it(
		`${write} of an account whose amount does not encode fails with a schema error and stores nothing`,
		[],
		function* ({ endings, storedAccounts, writeAccountWithTextAmount }) {
			yield* writeAccountWithTextAmount(write);

			yield* outcomes({
				"stored accounts": [storedAccounts(), []],
				[`${write} ending`]: [endings(), ["failed with a schema error"]],
			});
		},
	);
}

for (const [reason, updateColumns] of [
	["no columns", []],
	["a column the model lacks", ["missing"]],
	["the id column", ["id"]],
	["the conflict column", ["externalKey"]],
	["an insert-only column", ["origin"]],
	["a column the input leaves out", ["note"]],
] as const satisfies readonly (readonly [string, readonly AccountColumn[]])[]) {
	conflicts.it(
		`upsert that updates ${reason} fails with a schema error and keeps the stored account`,
		[accountExists("one", one)],
		function* ({ endings, storedAccounts, upsertAccount }) {
			yield* upsertAccount("one", retry, updateColumns);

			yield* outcomes({
				"stored accounts": [storedAccounts(), [{ amount: "52", externalKey: "prefix:one", origin: "import" }]],
				"upsert ending": [endings(), ["failed with a schema error"]],
			});
		},
	);
}

conflicts.it(
	"insertOrIgnore through a repository whose conflict column the model lacks fails with a schema error and stores nothing",
	[],
	function* ({ endings, insertWithUnknownConflictColumn, storedAccounts }) {
		yield* insertWithUnknownConflictColumn("one", one);

		yield* outcomes({
			"insertOrIgnore ending": [endings(), ["failed with a schema error"]],
			"stored accounts": [storedAccounts(), []],
		});
	},
);
