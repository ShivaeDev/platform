import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { migratePostgres } from "#migrations.ts";
import { onPostgres } from "./engines.ts";
import { componentOf, described, loaderOf, type Migration } from "./migrationCatalog.ts";
import { migrationEngine } from "./migrationEngine.ts";
import { migrationVerbs, type RunOptions } from "./migrationVerbs.ts";

export const migrationRuns = storyKit({
	...onPostgres,
	create: migrationEngine,
	inspect: (engine) => ({ bodiesRun: engine.bodiesRun, runs: engine.runs, tables: engine.tables, verdicts: engine.verdicts }),
	name: "PostgreSQL migrations",
	stages: ["ledger", "drift"],
	verbs: (engine, story) => migrationVerbs(engine, story.tell),
});

export function applied(migrations: readonly Migration[], options: Pick<RunOptions, "components" | "release"> = {}) {
	const extras = [
		...(options.components === undefined ? [] : [`schema components ${options.components.join(", ")}`]),
		...(options.release === undefined ? [] : [`release ${options.release}`]),
	];
	return migrationRuns.trait(
		"ledger",
		`an earlier run applied ${described(migrations)}${extras.length === 0 ? "" : ` with ${extras.join(" and ")}`}`,
		(engine) =>
			migratePostgres({
				components: (options.components ?? []).map((name) => componentOf(engine, name)),
				loader: loaderOf(engine, migrations),
				lockTimeout: "5 seconds",
				table: engine.tables.ledger,
				...(options.release === undefined ? {} : { release: options.release }),
			}).pipe(
				Effect.andThen(
					Effect.sync(() => {
						engine.bodiesRun.length = 0;
					}),
				),
			),
	);
}

export function ledgerRenames(id: number, name: string) {
	return migrationRuns.trait("drift", `the ledger's migration ${id} is renamed to ${name}`, ({ sql, tables }) =>
		Effect.asVoid(sql`update ${sql(tables.ledger)} set name = ${name} where migration_id = ${id}`),
	);
}

export function ledgerLacksNameColumn() {
	return migrationRuns.trait("ledger", "a table with the ledger's name exists without a name column", ({ sql, tables }) =>
		Effect.asVoid(sql`create table ${sql(tables.ledger)} (migration_id integer primary key)`),
	);
}

export function orderIndexDropped() {
	return migrationRuns.trait("drift", "someone drops the order index", ({ sql, tables }) =>
		Effect.asVoid(sql`drop index ${sql(`${tables.orders}_name`)}`),
	);
}
