import { resolve } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import type { Pool } from "pg";
import { pgBossSchema } from "@shivaedev/effect-pg-boss/server/schema.ts";
import { migrationsFromDirectory } from "@shivaedev/effect-sql/migrationsFromDirectory.ts";
import { notesMigrations } from "#modules/notes/server/migrations.ts";
import { AuthMigrationDatabase } from "#server/AuthMigrationDatabase.ts";

export function migrations(database: Pool) {
	const loaders = [migrationsFromDirectory(resolve(import.meta.dirname, "../..")).pipe(Effect.provide(NodeServices.layer)), notesMigrations];
	return {
		components: [pgBossSchema()],
		loader: Effect.all(loaders).pipe(
			Effect.map((entries) => entries.flat()),
			Effect.map((entries) =>
				entries.map(
					([id, name, load]) =>
						[
							id,
							name,
							load.pipe(Effect.map((module) => ({ default: Effect.provideService(module.default, AuthMigrationDatabase, database) }))),
						] as const,
				),
			),
		),
		table: "app_migrations",
	};
}
