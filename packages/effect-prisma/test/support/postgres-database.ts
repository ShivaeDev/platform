import { it } from "@effect/vitest";
import { Effect } from "effect";
import { type DatabaseServiceOf, makeDatabase } from "#index.ts";
import { type Contract, contractJson } from "#test/contract.ts";
import { environmentVariable } from "./environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL");
export const integrationEffect = databaseUrl === undefined ? it.effect.skip : it.effect;

export const Database = makeDatabase<Contract>()("@test/IntegrationDatabase", {
	contractJson,
});
export type DatabaseService = DatabaseServiceOf<typeof Database>;
export const scopedValues = (db: DatabaseService, email: string) => ({
	db,
	posts: db.Post,
	relation: db.User.where({ email }),
	stream: db.User.where({ email }).stream,
});
const DatabaseLive = Database.layer({
	url: databaseUrl ?? "postgresql://integration-tests-disabled",
});
export const withDatabase = Effect.provide(DatabaseLive);

export const uniqueEmail = (scenario: string): string => `${scenario}-${crypto.randomUUID()}@example.test`;
