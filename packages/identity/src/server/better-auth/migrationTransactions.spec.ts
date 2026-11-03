import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { authMigrationTransactions } from "#test/better-auth/migrationTransactions.ts";

authMigrationTransactions.it(
	"a numbered migration reads and writes alice's auth row through one connection without deadlocking after auth DDL",
	[],
	function* ({ migrate, storedUsers, storedMigrationRegistrations }) {
		expect(yield* storedUsers()).toEqual([]);

		const applied = yield* migrate();

		yield* outcomes([
			["applied migrations", () => Effect.succeed(applied), [[3, "register"]]],
			["stored auth users", () => storedUsers(), ["alice@composition.test"]],
			["stored migration registrations", () => storedMigrationRegistrations(), [{ email: "alice@composition.test", role: "member" }]],
		]);
	},
);
