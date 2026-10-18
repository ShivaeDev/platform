import { afterAll } from "vitest";
import { makeSqliteDatabase } from "#sqlite.ts";
import { controlledRuntime } from "#test/runtimeControls.ts";
import { type Contract, contractJson } from "./contract.ts";
import { makeTemporaryDatabase } from "./makeTemporaryDatabase.ts";

export const temporary = makeTemporaryDatabase();
afterAll(temporary.remove);

export const Database = makeSqliteDatabase<Contract>()("@test/SqliteDatabase", {
	contractJson,
});
export const DatabaseLive = Database.layer({ middleware: [controlledRuntime], path: temporary.path });

export function uniqueEmail(scenario: string): string {
	return `${scenario}-${crypto.randomUUID()}@example.test`;
}
