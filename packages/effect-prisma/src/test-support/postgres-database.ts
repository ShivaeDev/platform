import { makeDatabase } from "#database.ts";
import type { DatabaseServiceOf } from "#databaseTypes.ts";
import { type Contract, contractJson } from "#test/contract.ts";
import { environmentVariable } from "./environment.ts";

export const databaseUrl = environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL");

export const Database = makeDatabase<Contract>()("@test/IntegrationDatabase", {
	contractJson,
});
export type DatabaseService = DatabaseServiceOf<typeof Database>;
export function scopedValues(db: DatabaseService, email: string) {
	return {
		db,
		posts: db.Post,
		relation: db.User.where({ email }),
		stream: db.User.where({ email }).stream,
	};
}
export const DatabaseLive = Database.layer({
	url: databaseUrl ?? "postgresql://integration-tests-disabled",
});

export function uniqueEmail(scenario: string): string {
	return `${scenario}-${crypto.randomUUID()}@example.test`;
}
