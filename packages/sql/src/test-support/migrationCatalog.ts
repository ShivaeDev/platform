import { Deferred, Effect } from "effect";
import type { Migrator } from "effect/sql";
import { readPostgresRelease } from "#postgresRelease.ts";
import type { SchemaComponent } from "#SchemaComponent.ts";
import type { MigrationEngine } from "./migrationEngine.ts";

export type MigrationName =
	| "add_order_four"
	| "add_order_three"
	| "add_order_two"
	| "add_printer_paper"
	| "add_printer_paper_twice"
	| "append_four"
	| "append_three"
	| "create_audit_and_add_printer_paper"
	| "create_orders"
	| "pause_then_add_printer_paper"
	| "read_lock_timeout"
	| "record_first"
	| "record_second";

export type Migration = `${number}_${MigrationName}`;

export type ComponentName = "failing jobs storage" | "order index" | "release watcher";

function bodies(engine: MigrationEngine): ReadonlyMap<string, Effect.Effect<unknown, unknown>> {
	const { sql, tables } = engine;
	const orders = sql(tables.orders);
	function add(name: string) {
		return sql`insert into ${orders} (name) values (${name})`;
	}
	function append(suffix: string) {
		return sql`update ${orders} set name = name || ${suffix}`;
	}
	return new Map<MigrationName, Effect.Effect<unknown, unknown>>([
		["add_order_four", add("four")],
		["add_order_three", add("three")],
		["add_order_two", add("two")],
		["add_printer_paper", add("Printer paper")],
		["add_printer_paper_twice", sql`insert into ${orders} (name) values ('Printer paper'), ('Printer paper')`],
		["append_four", append("-four")],
		["append_three", append("-three")],
		["create_audit_and_add_printer_paper", Effect.andThen(sql`create table ${sql(tables.audit)} (name text)`, add("Printer paper"))],
		["create_orders", sql`create table ${orders} (name text primary key)`],
		[
			"pause_then_add_printer_paper",
			Deferred.succeed(engine.pause.entered, undefined).pipe(
				Effect.andThen(Deferred.await(engine.pause.resume)),
				Effect.andThen(add("Printer paper")),
			),
		],
		[
			"read_lock_timeout",
			Effect.map(sql<{ readonly timeout: string }>`select current_setting('lock_timeout') as timeout`, ([row]) => {
				engine.lockTimeouts.push(row?.timeout ?? "unset");
			}),
		],
		["record_first", Effect.void],
		["record_second", Effect.void],
	]);
}

export function loaderOf(engine: MigrationEngine, migrations: readonly Migration[]): Migrator.Loader {
	const catalog = bodies(engine);
	return Effect.succeed(
		migrations.map((migration) => {
			const separator = migration.indexOf("_");
			const name = migration.slice(separator + 1);
			const body = catalog.get(name) ?? Effect.die(new Error(`The migration catalog has no ${name}`));
			return [
				Number(migration.slice(0, separator)),
				name,
				Effect.succeed(
					Effect.andThen(
						Effect.sync(() => engine.bodiesRun.push(name)),
						body,
					),
				),
			] as const;
		}),
	);
}

export function componentOf(engine: MigrationEngine, name: ComponentName): SchemaComponent {
	const { sql, tables } = engine;
	const index = `${tables.orders}_name`;
	switch (name) {
		case "failing jobs storage":
			return { apply: Effect.fail(new Error("jobs storage unavailable")), name, pending: Effect.succeed("jobs storage missing") };
		case "order index":
			return {
				apply: sql`create index concurrently if not exists ${sql(index)} on ${sql(tables.orders)} (name)`,
				name,
				pending: Effect.map(sql<{ readonly name: string | null }>`select to_regclass(${index})::text as name`, ([row]) =>
					row?.name === null || row === undefined ? "index missing" : undefined,
				),
			};
		case "release watcher":
			return {
				apply: Effect.map(readPostgresRelease(tables.ledger), (marker) => {
					engine.releasesSeenByComponents.push(marker?.release ?? "none");
				}),
				name,
				pending: Effect.succeed(undefined),
			};
	}
}

export function described(migrations: readonly Migration[]) {
	return migrations.length === 0 ? "no migrations" : migrations.join(", ");
}
