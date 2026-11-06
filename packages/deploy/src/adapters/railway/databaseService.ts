import type { DatabaseConfig, VolumeMount, VolumeNode } from "railway/iac";
import { checkPostgresImage } from "./checkPostgresImage.ts";
import { configurePostgres } from "./configurePostgres.ts";
import type { PageCacheTrim } from "./postgresStartCommand.ts";

export type DatabaseServiceConfig = DatabaseConfig & {
	limits: { cpu: number; memoryBytes: number; diskBytes?: number };
	volume: VolumeNode;
	backupSchedules?: VolumeMount["backupSchedules"];
	pageCacheTrim?: PageCacheTrim;
};

export async function databaseService(name: string, config: DatabaseServiceConfig) {
	const database = configurePostgres(name, config);
	await checkPostgresImage(database.image);
	return database;
}
