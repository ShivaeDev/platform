import { makeDatabase } from "@shivaedev/effect-prisma/database.ts";
import type { Contract } from "#test/auth/generated/contract.d.ts";
import contractJson from "#test/auth/generated/contract.json" with { type: "json" };
import { environmentVariable } from "#test/environmentVariable.ts";
export const databaseUrl = environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL");
export const Database = makeDatabase<Contract>()("@test/PlatformAuthDatabase", { contractJson });
export const DatabaseLive = Database.layer({ url: databaseUrl ?? "postgresql://integration-tests-disabled" });
