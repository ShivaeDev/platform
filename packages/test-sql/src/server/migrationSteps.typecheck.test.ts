import { Effect, Scope } from "effect";
import type { Migrator, SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf } from "vitest";
import { defineService } from "@shivaedev/service/defineService.ts";
import { migrationSteps } from "#migrationSteps.ts";
import { migrations } from "#test/migrationSteps.ts";

const Dependency = defineService({
	id: "MigrationStepsDependency",
	initialize: Effect.void,
	methods: () => ({}),
	requires: [],
});
type Dependency = typeof Dependency.Identifier;

const steps = migrationSteps({
	...migrations,
	components: [{ apply: Effect.asVoid(Dependency), name: "dependent schema", pending: Effect.as(Dependency, undefined) }],
	loader: Effect.gen(function* () {
		yield* Dependency;
		yield* Scope.Scope;
		return yield* migrations.loader;
	}),
});

expectTypeOf<Effect.Error<typeof steps>>().toEqualTypeOf<Migrator.MigrationError>();
expectTypeOf<Effect.Services<typeof steps>>().toEqualTypeOf<Dependency | Scope.Scope | SqlClient.SqlClient>();

declare const controller: Effect.Success<typeof steps>;
const partial = controller.migrateTo("1_create_contacts");
expectTypeOf<Effect.Error<typeof partial>>().toEqualTypeOf<Migrator.MigrationError | SqlError>();
expectTypeOf<Effect.Services<typeof partial>>().toEqualTypeOf<never>();
expectTypeOf<Effect.Error<typeof controller.migrateToLatest>>().toEqualTypeOf<Migrator.MigrationError | SqlError>();
expectTypeOf<Effect.Services<typeof controller.migrateToLatest>>().toEqualTypeOf<never>();
