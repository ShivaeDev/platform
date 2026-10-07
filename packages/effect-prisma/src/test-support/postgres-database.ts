import { it } from "@effect/vitest";
import { Effect } from "effect";
import { makeDatabase } from "#database.ts";
import type { DatabaseServiceOf } from "#databaseTypes.ts";
import { type Contract, contractJson } from "#test/contract.ts";
import { environmentVariable } from "./environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL");
export const integrationEffect = databaseUrl === undefined ? it.effect.skip : it.effect;

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
const DatabaseLive = Database.layer({
	url: databaseUrl ?? "postgresql://integration-tests-disabled",
});
export const withDatabase = Effect.provide(DatabaseLive);

export function uniqueEmail(scenario: string): string {
	return `${scenario}-${crypto.randomUUID()}@example.test`;
}
