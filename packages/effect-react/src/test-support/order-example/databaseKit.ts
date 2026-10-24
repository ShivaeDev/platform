import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Exit, Layer, Redacted, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
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
export const databases = storyKit({
	clock: "live",
	create: () => create,
	inspect: (engine) => ({ database: engine.name, leases: [...engine.leases.keys()] }),
	name: "order database",
	runIf: hasPostgres,
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
		database: () =>
			Effect.gen(function* () {
				story.tell("read the database catalog after releasing a lease");
				return { name: engine.name, rows: yield* engine.observer`select datname from pg_database where datname = ${engine.name}` };
			}),
		leaseDatabases: () =>
			Effect.gen(function* () {
				story.tell("the two leases share a database and have usable pools");
				const names: string[] = [];
				for (const { database } of engine.leases.values()) {
					names.push(database.name);
					yield* database.sql`select 1`;
					yield* database.observer`select 1`;
				}
				return names;
			}),
		migrationLedger: (name: string) =>
			Effect.gen(function* () {
				story.tell(`the ${name} lease keeps its migration ledger`);
				const lease = engine.leases.get(name);
				if (lease === undefined) {
					return yield* Effect.die(`Missing lease ${name}`);
				}
				return yield* lease.database.observer`select migration_id from effect_sql_migrations`;
			}),
		overlappingStories: () => overlappingStories(story.tell),
	}),
});
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
