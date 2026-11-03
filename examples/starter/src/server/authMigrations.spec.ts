import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { emptyDatabase, legacyUser, migration } from "#test-support/migration.ts";

migration.it(
	"the numbered migrations leave a schema Better Auth accepts, with a required user role that defaults to user",
	[emptyDatabase],
	function* ({ authSchemaCheck, migrates, roleColumn }) {
		yield* migrates();

		yield* outcomes([
			["auth schema", () => authSchemaCheck(), "accepted"],
			["role column", () => roleColumn(), "text, not null, default 'user'"],
		]);
	},
);

migration.it(
	"the stored-roles migration gives alice, a user from before roles, the user role",
	[emptyDatabase, legacyUser],
	function* ({ roleColumn, rolesMigrationRuns, storedRoles }) {
		expect(yield* roleColumn()).toBe("text, nullable, no default");

		yield* rolesMigrationRuns();

		expect(yield* storedRoles()).toEqual([{ email: "alice@migration.test", role: "user" }]);
	},
);
