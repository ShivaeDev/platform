import { expect } from "vitest";
import { legacyUser, migration } from "#test-support/migration.ts";

migration.it("numbered migrations create the user role with its default and non-null constraint", [], function* ({ migrate, roleColumn }) {
	yield* migrate();

	expect(yield* roleColumn()).toEqual([{ default: "'user'::text", nullable: "NO", type: "text" }]);
});

migration.it(
	"an existing user adopts the user role through numbered migrations without a backfill",
	[legacyUser],
	function* ({ adoptRoles, roleColumn, storedRoles }) {
		expect(yield* roleColumn()).toEqual([]);

		yield* adoptRoles();

		expect(yield* storedRoles()).toEqual([{ email: "alice@migration.test", role: "user" }]);
	},
);
