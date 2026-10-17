import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Exit, Layer, Redacted, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { databaseFailures } from "./databaseFailures.ts";
import { overlappingStories } from "./overlappingStories.ts";
import { acquireDatabase, databaseUrl, disposableDestination, hasPostgres } from "./postgres.ts";

const create = Effect.gen(function* () {
	const url = disposableDestination(databaseUrl._tag === "Some" ? databaseUrl.value : "");
	url.pathname = "/postgres";
	const running: { stopQuery?: () => Effect.Effect<void> } = {};
	const observer = Context.get(yield* Layer.build(PgClient.layer({ url: Redacted.make(url.toString()) })), SqlClient.SqlClient);
	return {
		leases: new Map<string, { scope: Scope.Closeable; database: Effect.Success<typeof acquireDatabase> }>(),
		name: "",
		observer,
		running,
	};
});
export type DatabaseEngine = Effect.Success<typeof create>;
const kit = storyKit({
	clock: "live",
	create: () => create,
	inspect: (engine) => ({ database: engine.name, leases: [...engine.leases.keys()] }),
	name: "order database",
	stages: ["leases"],
	verbs: (engine, story) => ({
		...databaseFailures(engine, story.tell),
		closeLease: (name: string) =>
			Effect.gen(function* () {
				story.tell(`the ${name} lease closes its pools`);
				const lease = engine.leases.get(name);
				if (lease === undefined) {
					return yield* Effect.die(`Missing lease ${name}`);
				}
				yield* Scope.close(lease.scope, Exit.void);
				engine.leases.delete(name);
			}),
		databaseWasDropped: () =>
			Effect.gen(function* () {
				story.tell("the last lease dropped the database");
				expect(engine.name).toMatch(/^platform_story_/u);
				expect(yield* engine.observer`select datname from pg_database where datname = ${engine.name}`).toEqual([]);
			}),
		leasesShareDatabase: () =>
			Effect.gen(function* () {
				story.tell("the two leases share a database and have usable pools");
				const names = new Set<string>();
				for (const { database } of engine.leases.values()) {
					names.add(database.name);
					yield* database.sql`select 1`;
					yield* database.observer`select 1`;
				}
				expect(names.size).toBe(1);
			}),
		migrationLedgerIsPreserved: (name: string) =>
			Effect.gen(function* () {
				story.tell(`the ${name} lease keeps its migration ledger`);
				const lease = engine.leases.get(name);
				if (lease === undefined) {
					return yield* Effect.die(`Missing lease ${name}`);
				}
				expect(yield* lease.database.observer`select migration_id from effect_sql_migrations`).toEqual([{ "migration_id": 1 }]);
			}),
		overlappingStoriesKeepTheirRows: () => overlappingStories(story.tell),
	}),
});
export const databases = { ...kit, it: kit.it.runIf(hasPostgres) };
export function twoLeasesAreOpen() {
	return databases.trait("leases", "two callers lease the worker database", function* (engine) {
		for (const name of ["first", "second"]) {
			const scope = yield* Scope.make();
			yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
			const database = yield* acquireDatabase.pipe(Effect.provideService(Scope.Scope, scope));
			engine.name = database.name;
			engine.leases.set(name, { database, scope });
		}
	});
}
