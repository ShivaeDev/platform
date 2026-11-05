import { Effect } from "effect";
import type { PostgresMigrationOptions } from "@shivaedev/sql/migrations.ts";
import { captureMigrationSteps } from "#server/adapters/captureMigrationSteps.ts";

export const migrationSteps = Effect.fn("PostgresTest.migrationSteps")(<R, E = never>(migrations: PostgresMigrationOptions<R, E>) =>
	captureMigrationSteps(migrations),
);
