import { type DatabaseConfig, postgres } from "railway/iac";
import { type PageCacheTrim, postgresStartCommand } from "#adapters/railway/postgresStartCommand.ts";

export type PostgresConfig = DatabaseConfig & {
	limits: { cpu: number; memoryBytes: number; diskBytes?: number };
	pageCacheTrim?: PageCacheTrim;
};

export function configurePostgres(name: string, { limits, pageCacheTrim, ...config }: PostgresConfig) {
	const database = postgres(name, config);
	database.deploy = {
		...database.deploy,
		limitOverride: { containers: limits },
		startCommand: postgresStartCommand(pageCacheTrim),
	};
	database.source = { ...database.source, type: "image" };
	return database;
}
