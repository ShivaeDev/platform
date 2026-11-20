import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { applicationAuthTransactions, refusingAccountHook, transactionLocalAuth } from "#test/better-auth/applicationTransactions.ts";

applicationAuthTransactions.it(
	"a startup adapter keeps and announces alice's auth write after a later application transaction rolls back",
	[],
	function* ({ announcedLists, registerAlice, storedUsers, storedRegistrations }) {
		expect(yield* storedUsers()).toEqual([]);

		const status = yield* registerAlice("rollback");

		yield* outcomes([
			["auth response", () => Effect.succeed(status), 200],
			["stored auth users", () => storedUsers(), ["alice@composition.test"]],
			["stored application registrations", () => storedRegistrations(), []],
			["announced lists", () => announcedLists(), ["identity.users", "identity.sessions"]],
		]);
	},
);

applicationAuthTransactions.it(
	"a refusing account hook keeps its SQL write while the provider rolls alice's auth user back",
	[refusingAccountHook],
	function* ({ announcedLists, signUpAlice, storedUsers, storedHookWrites }) {
		expect(yield* storedHookWrites()).toEqual([]);

		const response = yield* signUpAlice();

		yield* outcomes([
			["auth refusal", () => Effect.succeed(response), { body: { code: "ACCOUNT_REFUSED" }, status: 403 }],
			["stored auth users", () => storedUsers(), []],
			["stored hook writes", () => storedHookWrites(), [{ kind: "before account" }]],
			["announced lists", () => announcedLists(), []],
		]);
	},
);

for (const outcome of ["commit", "rollback"] as const) {
	applicationAuthTransactions.it(
		`a transaction-local adapter and mount ${outcome} alice's auth, application and hook writes and their announcement together`,
		[transactionLocalAuth],
		function* ({ announcedLists, registerAlice, storedUsers, storedRegistrations, storedHookWrites }) {
			expect(yield* storedUsers()).toEqual([]);

			const status = yield* registerAlice(outcome);

			yield* outcomes([
				["auth response", () => Effect.succeed(status), 200],
				["stored auth users", () => storedUsers(), outcome === "commit" ? ["alice@composition.test"] : []],
				["stored application registrations", () => storedRegistrations(), outcome === "commit" ? [{ email: "alice@composition.test" }] : []],
				["stored hook writes", () => storedHookWrites(), outcome === "commit" ? [{ kind: "after user" }, { kind: "before account" }] : []],
				["announced lists", () => announcedLists(), outcome === "commit" ? ["identity.users", "identity.sessions"] : []],
			]);
		},
	);
}
