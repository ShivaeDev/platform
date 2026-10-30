import { type Context, Data, Effect, type Schema, type Scope } from "effect";
import { Migrator } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf } from "vitest";
import { assertPostgresMigrations } from "#assertPostgresMigrations.ts";
import { migratePostgres } from "#migrations.ts";
import { pendingPostgresMigrations } from "#pendingPostgresMigrations.ts";
import { runSchemaComponent } from "#SchemaComponent.ts";
import { WorkerRelease } from "#WorkerRelease.ts";

class ComponentUnavailable extends Data.TaggedError("ComponentUnavailable")<{ readonly message: string }> {}

const failed = Effect.fail(new ComponentUnavailable({ message: "unavailable" }));
const options = {
	components: [{ apply: failed, name: "storage", pending: failed }],
	loader: Migrator.fromRecord({}),
	lockTimeout: "5 seconds" as const,
};
const migrated = migratePostgres(options);
const pending = pendingPostgresMigrations(options);
const asserted = assertPostgresMigrations(options);
const component = runSchemaComponent("storage", failed);

expectTypeOf<Effect.Error<typeof component>>().toEqualTypeOf<ComponentUnavailable>();
expectTypeOf<Effect.Error<typeof migrated>>().toEqualTypeOf<ComponentUnavailable | Migrator.MigrationError | Schema.SchemaError | SqlError>();
expectTypeOf<Effect.Error<typeof pending>>().toEqualTypeOf<ComponentUnavailable | Migrator.MigrationError | Schema.SchemaError | SqlError>();
expectTypeOf<Effect.Error<typeof asserted>>().toEqualTypeOf<ComponentUnavailable | Migrator.MigrationError | Schema.SchemaError | SqlError>();

const registration = Effect.flatMap(WorkerRelease, (gate) => gate.register(() => failed));
expectTypeOf<Effect.Error<typeof registration>>().toEqualTypeOf<ComponentUnavailable>();
expectTypeOf<Effect.Services<typeof registration>>().toEqualTypeOf<Context.Service.Identifier<typeof WorkerRelease> | Scope.Scope>();
