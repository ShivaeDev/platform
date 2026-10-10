import { initTRPC } from "@trpc/server";
import { Effect } from "effect";
import { makeDatabase } from "@shivaedev/effect-prisma/database.ts";
import { makeEffectTRPC } from "@shivaedev/effect-trpc/adapter.ts";
import { effectPrismaAdapter } from "#better-auth/adapter.ts";
import { makePlatformRuntime } from "#runtime/make.ts";
import { type Contract, contractJson } from "#test/auth/contract.ts";
import { environmentVariable } from "#test/environment.ts";
import { makePlatformIt } from "#testing/vitest.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL");
export const Database = makeDatabase<Contract>()("@test/PlatformAuthDatabase", {
	contractJson,
});
const DatabaseLive = Database.layer({
	url: databaseUrl ?? "postgresql://integration-tests-disabled",
});
export const runtime = makePlatformRuntime(DatabaseLive);
export const authDatabase = effectPrismaAdapter(Database, runtime, {
	modelName: (model) => `Auth${model.length === 0 ? model : `${model[0]?.toUpperCase()}${model.slice(1)}`}`,
})({});
const adapter = makeEffectTRPC({ runtime });
const t = initTRPC.create();
const router = t.router({});
export const it = makePlatformIt(Database)({
	adapter,
	createCaller: () => router.createCaller({}),
	extend: ({ db }) =>
		Effect.succeed({
			userExists: (id: string) => db.AuthUser.where({ id }).exists(),
		}),
	layer: DatabaseLive,
});
export const integrationOptions = { skip: databaseUrl === undefined };
