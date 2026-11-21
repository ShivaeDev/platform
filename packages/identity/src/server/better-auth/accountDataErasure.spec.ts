import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ownedData } from "#test/better-auth/ownedData.ts";
import { forgottenTable, memoTables, ownedCycle, restrictChain } from "#test/better-auth/ownedTables.ts";

const CHAIN = ["projects", "tasks", "comments"] as const;

ownedData.it(
	"one erase removes alice's comment, task and project although each holds the next back with RESTRICT or NO ACTION, and keeps bob's",
	[restrictChain],
	function* ({ erase, storedOwners }) {
		const erased = yield* erase("alice");

		yield* outcomes([
			["erase", () => Effect.succeed(erased), "erased"],
			...CHAIN.map((table) => [`stored ${table} owners`, () => storedOwners(table), ["bob"]] as const),
		]);
	},
);

ownedData.it(
	"when the transaction around alice's erase fails, her comment, task and project are all still stored",
	[restrictChain],
	function* ({ eraseInFailedTransaction, storedOwners }) {
		const outcome = yield* eraseInFailedTransaction("alice");

		yield* outcomes([
			["transaction", () => Effect.succeed(outcome), "rolled back"],
			...CHAIN.map((table) => [`stored ${table} owners`, () => storedOwners(table), ["alice", "bob"]] as const),
		]);
	},
);

ownedData.it(
	"an erase over owned tables that hold each other back in a cycle fails naming the cycle's tables and deletes nothing",
	[ownedCycle],
	function* ({ erase, storedOwners }) {
		const erased = yield* erase("alice");

		yield* outcomes([
			["erase", () => Effect.succeed(erased), { cycle: ["public.drafts", "public.revisions"] }],
			["stored drafts owners", () => storedOwners("drafts"), ["alice"]],
			["stored revisions owners", () => storedOwners("revisions"), ["alice"]],
			["stored labels owners", () => storedOwners("labels"), ["alice"]],
		]);
	},
);

ownedData.it(
	"an erase refuses to run while a table refers to the user without an owned model",
	[restrictChain, forgottenTable],
	function* ({ erase, storedOwners }) {
		const erased = yield* erase("alice");

		yield* outcomes([
			["erase", () => Effect.succeed(erased), { uncovered: [{ column: "owner_id", schema: "public", table: "forgotten" }] }],
			["stored projects owners", () => storedOwners("projects"), ["alice", "bob"]],
		]);
	},
);

ownedData.it(
	"one erase removes alice's memos from both tables whose repositories share one model, and keeps bob's",
	[memoTables],
	function* ({ erase, storedOwners }) {
		const erased = yield* erase("alice");

		yield* outcomes([
			["erase", () => Effect.succeed(erased), "erased"],
			["stored memos owners", () => storedOwners("memos"), ["bob"]],
			["stored archived_memos owners", () => storedOwners("archived_memos"), ["bob"]],
		]);
	},
);
