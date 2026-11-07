import { postgres } from "railway/iac";
import type { DatabaseServiceConfig } from "#adapters/railway/databaseService.ts";
import { postgresStartCommand } from "#adapters/railway/postgresStartCommand.ts";

export function configurePostgres(name: string, { limits, volume, pageCacheTrim, ...config }: DatabaseServiceConfig) {
	const database = postgres(name, config);
	database.deploy = {
		...database.deploy,
		limitOverride: { containers: limits },
		startCommand: postgresStartCommand(pageCacheTrim),
	};
	database.source = { ...database.source, type: "image" };
	database.volumeAttachments = {
		[volume.name]: {
			mountPath: "/var/lib/postgresql/data",
			volume: volume.address,
			...(volume.config && { volumeConfig: volume.config }),
		},
	};
	return database;
}
