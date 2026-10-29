import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { Migrator } from "effect/sql";
import type { Pool } from "pg";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { AuthMigrationDatabase } from "#server/AuthMigrationDatabase.ts";
import { serverModules } from "#server/modules.ts";

export function migrations(database: Pool) {
	const loaders = serverModules.migrations.map((directory) => Migrator.fromFileSystem(directory).pipe(Effect.provide(NodeServices.layer)));
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
