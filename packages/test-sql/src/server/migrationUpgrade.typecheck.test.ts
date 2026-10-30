import { Effect, type Schema } from "effect";
import type { Migrator, SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf } from "vitest";
import { defineService } from "@shivaedev/service/defineService.ts";
import { Item, migrations, types } from "#test/migrationUpgrade.ts";
import { assertModelColumns, type ModelColumnMismatch } from "./assertModelColumns.ts";
import { migrationUpgrade, type PostgresColumn } from "./migrationUpgrade.ts";

const Dependency = defineService({
	id: "MigrationLoaderDependency",
	initialize: Effect.void,
	methods: () => ({}),
	requires: [],
});
type Dependency = typeof Dependency.Identifier;

const upgrade = migrationUpgrade({
	migrations: { ...migrations, loader: Effect.flatMap(Dependency, () => migrations.loader) },
	table: "items",
	upTo: 1,
});
expectTypeOf<Effect.Success<typeof upgrade>>().toEqualTypeOf<readonly PostgresColumn[]>();
expectTypeOf<Effect.Error<typeof upgrade>>().toEqualTypeOf<Migrator.MigrationError | SqlError | Schema.SchemaError>();
expectTypeOf<Effect.Services<typeof upgrade>>().toEqualTypeOf<Dependency | SqlClient.SqlClient>();

const assertion = assertModelColumns([], Item, types);
expectTypeOf<Effect.Error<typeof assertion>>().toEqualTypeOf<ModelColumnMismatch>();
expectTypeOf<Effect.Services<typeof assertion>>().toEqualTypeOf<never>();
// @ts-expect-error Every selected model field needs its PostgreSQL type.
assertModelColumns([], Item, { id: "integer", name: "text" });
// @ts-expect-error JSON-only fields are not database columns.
assertModelColumns([], Item, { ...types, publicLabel: "text" });
