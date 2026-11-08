import { Effect } from "effect";
import type { VolumeNode } from "railway/iac";
import { checkPostgresImage } from "#adapters/railway/checkPostgresImage.ts";
import { configurePostgres, type PostgresConfig } from "#adapters/railway/configurePostgres.ts";

export type DatabaseServiceConfig = PostgresConfig & {
	volume: VolumeNode;
};

export function databaseService(name: string, { volume, ...config }: DatabaseServiceConfig) {
	const database = configurePostgres(name, config);
	return Effect.tryPromise({
		catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
		try: async () => {
			await checkPostgresImage(database.image);
			return { database, resources: [database, volume] };
		},
	});
}
