import { type DatabaseConfig, postgres, type VolumeMount } from "railway/iac";

export type DatabaseServiceConfig = DatabaseConfig & {
	limits: { cpu: number; memoryBytes: number; diskBytes?: number };
	backupSchedules?: VolumeMount["backupSchedules"];
};

export function databaseService(name: string, { limits, backupSchedules = ["DAILY"], ...config }: DatabaseServiceConfig) {
	const database = postgres(name, config);
	database.deploy = { ...database.deploy, limitOverride: { containers: limits } };
	database.volumeMounts = { "/var/lib/postgresql/data": { backupSchedules } };
	return database;
}
