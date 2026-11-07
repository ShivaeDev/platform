import type { DatabaseConfig, VolumeNode } from "railway/iac";
import { checkPostgresImage } from "#adapters/railway/checkPostgresImage.ts";
import { configurePostgres } from "#adapters/railway/configurePostgres.ts";
import type { PageCacheTrim } from "#adapters/railway/postgresStartCommand.ts";

export type DatabaseServiceConfig = DatabaseConfig & {
	limits: { cpu: number; memoryBytes: number; diskBytes?: number };
	volume: VolumeNode;
	pageCacheTrim?: PageCacheTrim;
};

export async function databaseService(name: string, config: DatabaseServiceConfig) {
	const database = configurePostgres(name, config);
	await checkPostgresImage(database.image);
	return database;
}
