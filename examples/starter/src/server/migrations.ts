import { resolve } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import type { Pool } from "pg";
import { migrationsFromDirectory } from "@shivaedev/effect-sql/migrationsFromDirectory.ts";
import { AuthMigrationDatabase } from "#server/AuthMigrationDatabase.ts";

export function migrations(database: Pool) {
	return {
		loader: migrationsFromDirectory(resolve(import.meta.dirname, "../..")).pipe(
			Effect.provide(NodeServices.layer),
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
