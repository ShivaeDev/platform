import { postgres } from "railway/iac";
import type { DatabaseServiceConfig } from "./databaseService.ts";
import { postgresStartCommand } from "./postgresStartCommand.ts";

export function configurePostgres(
	name: string,
	{ limits, volume, backupSchedules = ["DAILY", "WEEKLY", "MONTHLY"], pageCacheTrim, ...config }: DatabaseServiceConfig,
) {
	const database = postgres(name, config);
	database.deploy = {
		...database.deploy,
		limitOverride: { containers: limits },
		startCommand: postgresStartCommand(pageCacheTrim),
	};
	database.source = {
		...database.source,
		autoUpdates: { schedule: null, tagMode: "sha", type: "minor" },
		type: "image",
	};
	database.volumeAttachments = {
		[volume.name]: {
			backupSchedules,
			mountPath: "/var/lib/postgresql/data",
			volume: volume.address,
			...(volume.config && { volumeConfig: volume.config }),
		},
	};
	return database;
}
