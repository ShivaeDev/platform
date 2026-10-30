import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Exit, Layer, Redacted, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { databaseFailures } from "./databaseFailures.ts";
import { failingApplicationStory, overlappingStories } from "./overlappingStories.ts";
import { acquireDatabase, databaseUrl, disposableDestination, hasPostgres } from "./postgres.ts";

const create = Effect.gen(function* () {
	const url = disposableDestination(databaseUrl._tag === "Some" ? databaseUrl.value : "");
	url.pathname = "/postgres";
	const running: { stopQuery?: () => Effect.Effect<void> } = {};
	const reports: {
		failing?: Effect.Success<ReturnType<typeof failingApplicationStory>>;
		overlapping?: Effect.Success<ReturnType<typeof overlappingStories>>;
	} = {};
	const observer = Context.get(yield* Layer.build(PgClient.layer({ url: Redacted.make(url.toString()) })), SqlClient.SqlClient);
	return {
		leases: new Map<string, { scope: Scope.Closeable; database: Effect.Success<typeof acquireDatabase> }>(),
		name: "",
		observer,
		reports,
		running,
		setup: "not run",
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
				const rows = yield* engine.observer`select datname from pg_database where datname = ${engine.name}`;
				return rows.length === 0 ? "dropped" : "still exists";
			}),
		failingStoryReport: () => Effect.sync(() => engine.reports.failing),
		leaseDatabases: () =>
			Effect.gen(function* () {
				const names: string[] = [];
				for (const { database } of engine.leases.values()) {
					yield* database.sql`select 1`;
					yield* database.observer`select 1`;
					names.push(database.name);
				}
				return names;
			}),
		migrationLedger: (name: string) =>
			Effect.gen(function* () {
				const lease = engine.leases.get(name);
				if (lease === undefined) {
					return yield* Effect.die(`Missing lease ${name}`);
				}
				return yield* lease.database.observer`select migration_id from effect_sql_migrations`;
			}),
		overlappingReport: () => Effect.sync(() => engine.reports.overlapping),
		runFailingApplicationStory: () =>
			Effect.map(failingApplicationStory(story.tell), (report) => {
				engine.reports.failing = report;
			}),
		runOverlappingStories: () =>
			Effect.map(overlappingStories(story.tell), (report) => {
				engine.reports.overlapping = report;
			}),
		setup: () => Effect.sync(() => engine.setup),
	}),
});
export function leasesAreOpen(names: readonly string[] = ["first", "second"]) {
	return databases.trait(
		"leases",
		`${names.length === 2 ? "two callers lease" : `only the ${names.join(" and ")} caller leases`} the worker database`,
		function* (engine) {
			for (const name of names) {
				const scope = yield* Scope.make();
				yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
				const database = yield* acquireDatabase.pipe(Effect.provideService(Scope.Scope, scope));
				engine.name = database.name;
				engine.leases.set(name, { database, scope });
			}
		},
	);
}
