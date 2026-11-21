import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { Data, Effect, Redacted, Schema } from "effect";
import { Migrator, SqlClient, SqlSchema } from "effect/sql";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { collectRepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { accountData } from "#server/better-auth/accountData.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { storedExportAccount } from "#server/better-auth/test-support/exportAccounts.ts";
import { ownedModels } from "#test/better-auth/ownedModels.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl } from "#test/postgres.ts";

// Applications build their client with clientOptions, so stored names are snake case beneath camel-case fields.
const postgres = makePostgresTestLayer({
	...clientOptions({ url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled") }),
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
});

class AbandonedDeletion extends Data.TaggedError("AbandonedDeletion") {}

const Owner = Schema.Struct({ owner: Schema.NullOr(Schema.String) });

export const ownedData = storyKit({
	around: (effect) => withIdentityDatabase(effect.pipe(Effect.provide(collectRepositoryModels))),
	clock: storyClock,
	*create() {
		const pool = yield* betterAuthDatabase();
		const options = { database: pool, logger: { disabled: true }, secret: "owned-data-story-secret-at-least-32-characters" };
		yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
		const auth = betterAuth({ ...options, plugins: [testUtils()] });
		const users = new Map<string, string>();
		for (const name of ["alice", "bob", "charlie"]) {
			const { user } = yield* signedInUser(auth, { email: `${name}@export.test`, name });
			users.set(name, user.id);
			if (name !== "charlie") {
				yield* storedExportAccount(name, user.id);
			}
		}
		return { data: accountData({ options: {} }), users };
	},
	layer: postgres,
	name: "owned account data",
	runIf: databaseUrl !== undefined,
	stages: ["tables", "coverage"],
	verbs: (engine, story) => {
		function userId(name: string) {
			const id = engine.users.get(name);
			if (id === undefined) {
				throw new Error(`No user exists for ${name}`);
			}
			return id;
		}
		return {
			check: () => {
				story.tell("check that an owned model covers every column referring to a person");
				return engine.data.check.pipe(
					Effect.as("covered" as const),
					Effect.catchTag("UncoveredUserColumns", ({ columns }) => Effect.succeed(columns)),
				);
			},
			coverageMessage: () =>
				engine.data.check.pipe(
					Effect.as("covered"),
					Effect.catchTag("UncoveredUserColumns", (error) => Effect.succeed(error.message)),
				),
			erase: (name: string) => {
				story.tell(`erase ${name}'s owned rows`);
				return engine.data.eraseOwnedRows(userId(name)).pipe(
					Effect.as("erased" as const),
					Effect.catchTag("OwnedTableCycle", ({ tables }) => Effect.succeed({ cycle: tables })),
					Effect.catchTag("UncoveredUserColumns", ({ columns }) => Effect.succeed({ uncovered: columns })),
				);
			},
			eraseInFailedTransaction: (name: string) => {
				story.tell(`erase ${name}'s owned rows inside a transaction that then fails`);
				return transact(Effect.andThen(engine.data.eraseOwnedRows(userId(name)), Effect.fail(new AbandonedDeletion()))).pipe(
					Effect.catchTag("AbandonedDeletion", () => Effect.succeed("rolled back" as const)),
				);
			},
			exportAccount: (name: string) => {
				story.tell(`export ${name}'s account`);
				return engine.data.exportAccount(userId(name));
			},
			gainsRepository: (model: keyof typeof ownedModels) => {
				story.tell(`the application gives ${model} a repository whose model marks its owner`);
				return ownedModels[model];
			},
			requestExport: (name: string) =>
				engine.data.exportAccount(userId(name)).pipe(
					Effect.as("exported" as const),
					Effect.catchTag("UncoveredUserColumns", ({ columns }) => Effect.succeed(columns)),
				),
			storedOwners: Effect.fn("OwnedDataStory.storedOwners")(function* (table: string) {
				const sql = yield* SqlClient.SqlClient;
				const names = new Map([...engine.users].map(([name, id]) => [id, name]));
				const rows = yield* SqlSchema.findAll({
					execute: () => sql`select user_id as owner from ${sql(table)} order by user_id`,
					Request: Schema.Void,
					Result: Owner,
				})(undefined);
				return rows.map(({ owner }) => (owner === null ? "nobody" : (names.get(owner) ?? owner))).sort((left, right) => left.localeCompare(right));
			}),
		};
	},
});
