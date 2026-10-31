import { expect } from "vitest";
import { legacyUser, migration } from "#test-support/migration.ts";

migration.it(
	"numbered migrations cover current auth options with the user role default and non-null constraint",
	[],
	function* ({ migrate, roleColumn, checkAuthSchema }) {
		yield* migrate();
		yield* checkAuthSchema();

		expect(yield* roleColumn()).toEqual([{ default: "'user'::text", nullable: "NO", type: "text" }]);
	},
);

migration.it(
	"an existing user receives the default user role through the frozen numbered migration",
	[legacyUser],
	function* ({ adoptRoles, roleColumn, storedRoles }) {
		expect(yield* roleColumn()).toEqual([{ default: null, nullable: "YES", type: "text" }]);

		yield* adoptRoles();

		expect(yield* storedRoles()).toEqual([{ email: "alice@migration.test", role: "user" }]);
	},
);
