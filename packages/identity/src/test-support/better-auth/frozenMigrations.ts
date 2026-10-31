import type { BetterAuthOptions } from "better-auth";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { assertBetterAuthSchema } from "#server/better-auth/assertSchema.ts";
import { migrateBetterAuth } from "#server/better-auth/migrate.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { authMigrationFiles } from "./migrationFiles.ts";
import { authMigrationSchema } from "./migrationSchema.ts";

const columns = Effect.flatMap(
	SqlClient.SqlClient,
	(sql) =>
		sql<{ table: string; column: string; type: string; nullable: string }>`
	select table_name as "table", column_name as "column", data_type as type, is_nullable as nullable
	from information_schema.columns where table_schema = current_schema() and table_name in ('user', 'session', 'account', 'verification')
	order by table_name, ordinal_position`.withoutTransform,
);

export const frozenAuthMigrations = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const options: Omit<BetterAuthOptions, "database"> = { emailAndPassword: { enabled: true }, logger: { disabled: true } };
		return {
			files: yield* authMigrationFiles,
			options,
			storage: yield* authTestDatabase,
		};
	},
	layer: postgres,
	name: "frozen auth migrations",
	runIf: databaseUrl !== undefined,
	stages: ["history"],
	verbs: (engine, story) => ({
		addRoleOption: () =>
			Effect.sync(() => {
				story.tell("the current options add a required role with the member default");
				engine.options = {
					...engine.options,
					user: { additionalFields: { role: { defaultValue: "member", required: true, type: "string" } } },
				};
			}),
		changeRoleType: () =>
			Effect.sync(() => {
				engine.options = { ...engine.options, user: { additionalFields: { role: { required: true, type: "number" } } } };
			}),
		checkSchema: (defaultRole?: string) =>
			assertBetterAuthSchema(engine.options, defaultRole === undefined ? undefined : { defaultRole }).pipe(
				Effect.as("current"),
				Effect.catchTag("BetterAuthSchemaDrift", (error) => Effect.succeed(error.message)),
			),
		generateFirst: (defaultRole?: string) =>
			engine.files.generate("0001_auth", engine.options, defaultRole === undefined ? undefined : { defaultRole }),
		generateNext: (defaultRole?: string) =>
			engine.files.generate("0003_roles", engine.options, defaultRole === undefined ? undefined : { defaultRole }),
		makeRoleNullable: () => engine.storage.omitRole("no-existing-user"),
		makeRoleOptional: () =>
			Effect.sync(() => {
				engine.options = { ...engine.options, user: { additionalFields: { role: { required: false, type: "string" } } } };
			}),
		migrate: () => engine.files.migrate(),
		migrateLiveRoles: () => engine.files.migrate(liveAuthAlteration),
		replayOnFreshDatabase: () => withIsolatedDatabase(Effect.andThen(engine.files.migrate(), authMigrationSchema)),
		requireRole: () =>
			Effect.sync(() => {
				engine.options = { ...engine.options, user: { additionalFields: { role: { required: true, type: "string" } } } };
			}),
		storedColumns: () => columns,
		storedRoleColumn: () => engine.storage.roleColumn,
		storedSchema: () => authMigrationSchema,
		useSerialIds: () =>
			Effect.sync(() => {
				engine.options = { ...engine.options, advanced: { database: { generateId: "serial" } } };
			}),
	}),
});

export const referencingHistory = frozenAuthMigrations.trait("history", "the saved history adds roles after a table referencing users", (engine) =>
	withIsolatedDatabase(
		Effect.gen(function* () {
			yield* engine.files.generate("0001_auth", engine.options);
			yield* engine.files.referenceUsers();
			yield* engine.files.migrate();
			engine.options = { ...engine.options, user: { additionalFields: { role: { defaultValue: "member", required: true, type: "string" } } } };
			yield* engine.files.generate("0003_roles", engine.options);
		}),
	),
);

export const liveReferencingHistory = frozenAuthMigrations.trait("history", "a live auth migration follows a user foreign key", (engine) =>
	Effect.gen(function* () {
		yield* engine.files.generate("0001_auth", engine.options);
		yield* engine.files.referenceUsers();
	}),
);

export const liveAuthAlteration = migrateBetterAuth({
	logger: { disabled: true },
	user: { additionalFields: { role: { defaultValue: "member", required: true, type: "string" } } },
});
