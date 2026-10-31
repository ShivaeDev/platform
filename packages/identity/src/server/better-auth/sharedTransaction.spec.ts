import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { authTransactions } from "#test/better-auth/transactions.ts";

for (const [outcome, title] of [
	["commit", "alice's auth user commits with the application's transaction"],
	["rollback", "alice's auth user rolls back with the application's transaction"],
	["auth rollback", "a rolled-back auth transaction leaves the application transaction usable and alice absent"],
] as const) {
	authTransactions.it(title, [], function* ({ createUser, storedUsers }) {
		expect(yield* storedUsers()).toEqual([]);

		const created = yield* createUser(outcome);

		yield* outcomes({
			"created user": [Effect.succeed(created), "alice"],
			"stored users": [storedUsers(), outcome === "commit" ? ["alice"] : []],
		});
	});
}
