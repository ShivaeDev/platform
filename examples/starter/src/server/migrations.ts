import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { Migrator } from "effect/sql";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { serverModules } from "#server/modules.ts";

export function migrations() {
	const loaders = serverModules.migrations.map((directory) => Migrator.fromFileSystem(directory).pipe(Effect.provide(NodeServices.layer)));
	return {
		components: [pgBossSchema()],
		loader: Effect.all(loaders).pipe(Effect.map((entries) => entries.flat())),
		table: "app_migrations",
	};
}
