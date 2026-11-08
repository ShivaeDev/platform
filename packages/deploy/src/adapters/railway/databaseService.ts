import { Effect } from "effect";
import type { DatabaseConfig, VolumeNode } from "railway/iac";
import { checkPostgresImage } from "#adapters/railway/checkPostgresImage.ts";
import { configurePostgres } from "#adapters/railway/configurePostgres.ts";
import type { PageCacheTrim } from "#adapters/railway/postgresStartCommand.ts";

export type DatabaseServiceConfig = DatabaseConfig & {
	limits: { cpu: number; memoryBytes: number; diskBytes?: number };
	volume: VolumeNode;
	pageCacheTrim?: PageCacheTrim;
};

export function databaseService(name: string, config: DatabaseServiceConfig) {
	const database = configurePostgres(name, config);
	return Effect.tryPromise({
		catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
		try: async () => {
			await checkPostgresImage(database.image);
			return database;
		},
	});
}
