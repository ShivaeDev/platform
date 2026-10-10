import { Effect } from "effect";
import { afterAll } from "vitest";
import { makeSqliteDatabase } from "#sqlite.ts";
import { type Contract, contractJson } from "./contract.ts";
import { makeTemporaryDatabase } from "./makeTemporaryDatabase.ts";

export const temporary = makeTemporaryDatabase();
afterAll(temporary.remove);

export const Database = makeSqliteDatabase<Contract>()("@test/SqliteDatabase", {
	contractJson,
});
export const DatabaseLive = Database.layer({ path: temporary.path });
export const withDatabase = Effect.provide(DatabaseLive);

export function uniqueEmail(scenario: string): string {
	return `${scenario}-${crypto.randomUUID()}@example.test`;
}
