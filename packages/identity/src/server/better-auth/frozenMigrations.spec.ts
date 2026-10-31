import { expect } from "vitest";
import { frozenAuthMigrations, liveReferencingHistory, referencingHistory } from "#test/better-auth/frozenMigrations.ts";

frozenAuthMigrations.it(
	"with only Effect installed the frozen first migration builds the same schema after current options add a role",
	[],
	function* ({ generateFirst, migrate, storedSchema, addRoleOption, replayOnFreshDatabase }) {
		yield* generateFirst();
		yield* migrate();
		const before = yield* storedSchema();
		expect(before.columns.filter(({ table, column }) => table === "user" && ["email", "role"].includes(column))).toEqual([
			{ column: "email", default: null, nullable: "NO", table: "user", type: "text" },
		]);

		yield* addRoleOption();

		expect(yield* replayOnFreshDatabase()).toEqual(before);
	},
);

frozenAuthMigrations.it(
	"schema drift accepts the integer references of an auth schema using serial IDs",
	[],
	function* ({ useSerialIds, generateFirst, migrate, checkSchema }) {
		yield* useSerialIds();
		yield* generateFirst();

		yield* migrate();

		expect(yield* checkSchema()).toBe("current");
	},
);

frozenAuthMigrations.it(
	"changing the identity role default requires a new frozen migration",
	[],
	function* ({ generateFirst, migrate, checkSchema, generateNext }) {
		yield* generateFirst("guest");
		yield* migrate();
		expect(yield* checkSchema("guest")).toBe("current");

		expect(yield* checkSchema("member")).toBe("Auth schema needs a new migration:\ncolumn user.role requires DEFAULT 'member'");
		yield* generateNext("member");
		yield* migrate();
		expect(yield* checkSchema("member")).toBe("current");
	},
);

frozenAuthMigrations.it(
	"schema drift names an existing role column whose type no longer matches the options",
	[],
	function* ({ generateFirst, migrate, changeRoleType, checkSchema }) {
		yield* generateFirst("member");
		yield* migrate();

		yield* changeRoleType();

		expect(yield* checkSchema()).toBe("Auth schema needs a new migration:\ncolumn user.role requires type number (found text)");
	},
);

frozenAuthMigrations.it(
	"schema drift names a role column missing its required non-null constraint",
	[],
	function* ({ generateFirst, migrate, addRoleOption, makeRoleNullable, checkSchema }) {
		yield* generateFirst("member");
		yield* migrate();
		yield* addRoleOption();
		expect(yield* checkSchema()).toBe("current");

		yield* makeRoleNullable();

		expect(yield* checkSchema()).toBe("Auth schema needs a new migration:\ncolumn user.role requires NOT NULL");
	},
);

frozenAuthMigrations.it(
	"live auth DDL also uses the migration transaction after a user foreign key",
	[liveReferencingHistory],
	function* ({ migrateLiveRoles, storedRoleColumn }) {
		yield* migrateLiveRoles();

		expect(yield* storedRoleColumn()).toEqual([{ default: "'member'::text", nullable: "NO", type: "text" }]);
	},
);

frozenAuthMigrations.it(
	"generated SQL preserves role defaults containing SQL and TypeScript delimiters",
	[],
	function* ({ generateFirst, migrate, storedRoleColumn }) {
		yield* generateFirst(`team's \`\${role}\\ $auth_migration$;\n\n`);

		yield* migrate();

		expect(yield* storedRoleColumn()).toEqual([{ default: `'team''s \`\${role}\\ $auth_migration$;\n\n'::text`, nullable: "NO", type: "text" }]);
	},
);

frozenAuthMigrations.it(
	"schema drift names the missing role until a new frozen migration covers it",
	[],
	function* ({ generateFirst, migrate, checkSchema, addRoleOption, generateNext }) {
		yield* generateFirst();
		yield* migrate();
		expect(yield* checkSchema()).toBe("current");

		yield* addRoleOption();

		expect(yield* checkSchema()).toBe("Auth schema needs a new migration:\ncolumn user.role");
		yield* generateNext();
		yield* migrate();
		expect(yield* checkSchema()).toBe("current");
	},
);

frozenAuthMigrations.it(
	"a fresh migration transaction adds roles after an earlier migration references users without waiting on another pool",
	[referencingHistory],
	function* ({ migrate, storedColumns }) {
		yield* migrate();

		expect(yield* storedColumns()).toContainEqual({ column: "role", nullable: "NO", table: "user", type: "text" });
	},
);
