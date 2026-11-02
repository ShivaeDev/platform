import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { readPostgresRelease } from "@shivaedev/sql/postgresRelease.ts";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { assertModelColumns } from "#assertModelColumns.ts";
import { Item, types } from "./migrationUpgrade.ts";
import { failureOf, timesOf } from "./outcome.ts";
import type { UpgradeEngine } from "./upgradeStory.ts";

export function upgradeReadouts(engine: UpgradeEngine, story: Story<UpgradeEngine>) {
	return {
		appliedMigrations: () => {
			story.tell("the story reads the upgrade’s migration ledger");
			return Effect.flatMap(SqlClient.SqlClient, (sql) =>
				Effect.map(sql<{ id: number }>`select migration_id as id from ${sql(engine.ledger)} order by migration_id`, (rows) =>
					rows.map(({ id }) => id),
				),
			);
		},
		columns: () => {
			story.tell("the story reads the columns captured at the upgrade boundary");
			return Effect.sync(() => engine.columns);
		},
		columnsSeenByLaterMigration: () => {
			story.tell("the story reads the columns observed by the later migration");
			return Effect.sync(() => engine.columnsSeenByLaterMigration);
		},
		currentItemNames: () => {
			story.tell("the story reads the current item names");
			return Effect.flatMap(SqlClient.SqlClient, (sql) =>
				Effect.map(sql<{ name: string }>`select name from current_items order by id`, (rows) => rows.map(({ name }) => name)),
			);
		},
		itemNamesInOldColumn: () => {
			story.tell("the story reads the item names in the old column");
			return Effect.flatMap(SqlClient.SqlClient, (sql) =>
				Effect.map(sql<{ name: string }>`select old_name as name from items`, (rows) => rows.map(({ name }) => name)),
			);
		},
		loaderResolutions: () => {
			story.tell("the story reads how often the upgrade loader resolved");
			return Effect.sync(() => timesOf(engine.loads));
		},
		modelCheck: () => {
			story.tell("the story checks the captured columns against the item model");
			return assertModelColumns(engine.columns, Item, types).pipe(
				Effect.as("matches the model"),
				Effect.catchTag("ModelColumnMismatch", (mismatch) => Effect.succeed(failureOf(mismatch))),
			);
		},
		recordedRelease: () => {
			story.tell("the story reads the upgrade’s recorded PostgreSQL release");
			return Effect.map(readPostgresRelease(engine.ledger), (release) => release?.release ?? "none");
		},
		releaseSeenByLaterMigration: () => {
			story.tell("the story reads the release observed by the later migration");
			return Effect.sync(() => engine.releaseSeenByLaterMigration);
		},
		rowsSeenByLaterMigration: () => {
			story.tell("the story reads the rows observed by the later migration");
			return Effect.sync(() => engine.seenByLaterMigration);
		},
		upgradeOutcome: () => {
			story.tell("the story reads the upgrade outcome");
			return Effect.sync(() => engine.upgrade);
		},
	};
}
