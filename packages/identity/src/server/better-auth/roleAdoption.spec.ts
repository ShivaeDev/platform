import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { beforeRoles, existingUsers, freshRoles, roleAdoption } from "#test/better-auth/roleAdoption.ts";

roleAdoption.it(
	"existing alice and bob adopt the default member role without a backfill",
	[beforeRoles, existingUsers],
	function* ({ migrateRoles, roleColumn, sessionRole, storedRoles }) {
		expect(yield* roleColumn()).toEqual([]);

		yield* migrateRoles();

		yield* outcomes([
			["alice's session role", () => sessionRole("alice"), "member"],
			["bob's session role", () => sessionRole("bob"), "member"],
			[
				"stored user roles",
				() => storedRoles(),
				[
					{ email: "alice@roles.test", role: "member" },
					{ email: "bob@roles.test", role: "member" },
				],
			],
		]);
	},
);

for (const [schema, database] of [
	[beforeRoles, "upgraded"],
	[freshRoles, "fresh"],
] as const) {
	roleAdoption.it(
		`alice's sign-up on a ${database} database receives member even when she submits admin`,
		[schema],
		function* ({ migrateRoles, signUp }) {
			yield* migrateRoles();

			expect(yield* signUp("alice")).toEqual({ role: "member", status: 200 });
		},
	);
}

roleAdoption.it(
	"assignRole makes existing alice the first admin",
	[beforeRoles, existingUsers],
	function* ({ migrateRoles, assignAdmin, sessionRole }) {
		yield* migrateRoles();
		expect(yield* sessionRole("alice")).toBe("member");

		yield* assignAdmin("alice");

		expect(yield* sessionRole("alice")).toBe("admin");
	},
);

roleAdoption.it(
	"fresh and upgraded user tables have the same non-null text role and member default",
	[beforeRoles, existingUsers],
	function* ({ createFreshSchema, freshRoleColumn, migrateRoles, roleColumn }) {
		yield* createFreshSchema();

		yield* migrateRoles();

		const upgraded = yield* roleColumn();
		const fresh = yield* freshRoleColumn();
		expect(upgraded).toEqual([{ default: "'member'::text", nullable: "NO", type: "text" }]);
		expect(fresh).toEqual(upgraded);
	},
);

roleAdoption.it(
	"adopting a nullable role fills alice's missing role and keeps bob's admin role",
	[freshRoles, existingUsers],
	function* ({ assignAdmin, migrateRoles, removeRole, storedRoles }) {
		yield* assignAdmin("bob");
		yield* removeRole("alice");
		expect(yield* storedRoles()).toEqual([
			{ email: "alice@roles.test", role: null },
			{ email: "bob@roles.test", role: "admin" },
		]);

		yield* migrateRoles();

		expect(yield* storedRoles()).toEqual([
			{ email: "alice@roles.test", role: "member" },
			{ email: "bob@roles.test", role: "admin" },
		]);
	},
);
