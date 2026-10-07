import { initTRPC } from "@trpc/server";
import { Effect, Layer } from "effect";
import { expectTypeOf } from "vitest";
import { makeDatabase } from "@shivaedev/effect-prisma/database.ts";
import { makeEffectTRPC } from "@shivaedev/effect-trpc/adapter.ts";
import { makeRequestServices } from "@shivaedev/effect-trpc/request-services.ts";
import { effectPrismaAdapter } from "#better-auth/adapter.ts";
import { makePlatformRuntime } from "#runtime/make.ts";
import type { Contract } from "#test/auth/generated/contract.d.ts";
import contractJson from "#test/auth/generated/contract.json" with { type: "json" };
import { makePlatformIt } from "#testing/vitest.ts";

type IsAny<Value> = 0 extends 1 & Value ? true : false;

const Database = makeDatabase<Contract>()("@types/PlatformDatabase", {
	contractJson,
});
const DatabaseLive = Database.layer({ url: "postgresql://compile-only" });
const runtime = makePlatformRuntime(DatabaseLive);
const authDatabase = effectPrismaAdapter(Database, runtime)({});
const adapter = makeEffectTRPC({ runtime });
const t = initTRPC.context<{ readonly actor: string }>().create();
const procedure = adapter.procedure(
	t.procedure,
	makeRequestServices(() => Layer.empty),
);
const router = t.router({
	userCount: procedure.query(function* () {
		const db = yield* Database;
		return yield* db.AuthUser.count();
	}),
});

const it = makePlatformIt(Database)({
	adapter,
	createCaller: (options = { actor: "default" }) => router.createCaller(options),
	extend: () => Effect.succeed({ fixtureName: "typed" as const }),
	layer: DatabaseLive,
});

it.effectApp("preserves database, caller, and extension types", function* (app) {
	const databaseIsAny: IsAny<typeof app.db> = false;
	const callerIsAny: IsAny<typeof app.trpc> = false;
	expectTypeOf(app).not.toBeAny();
	expectTypeOf(app.db).not.toBeAny();
	expectTypeOf(app.trpc).not.toBeAny();
	expectTypeOf(app.promise).not.toBeAny();
	expectTypeOf(app.fixtureName).toEqualTypeOf<"typed">();

	const count = yield* app.trpc.userCount();
	expectTypeOf(count).toEqualTypeOf<number>();
	expectTypeOf(count).not.toBeAny();
	const promised = yield* app.promise(() => Promise.resolve("typed" as const));
	expectTypeOf(promised).toEqualTypeOf<"typed">();
	expectTypeOf(authDatabase).not.toBeAny();
	expectTypeOf(runtime.runPromise(Database)).not.toBeAny();

	const users = yield* app.db.AuthUser.where({ name: "Ada" });
	expectTypeOf(users).not.toBeAny();
	const email: string | undefined = users[0]?.email;
	expectTypeOf(email).not.toBeAny();
	void callerIsAny;
	void databaseIsAny;

	// @ts-expect-error Unknown procedures remain rejected.
	yield* app.trpc.missing();
	// @ts-expect-error Caller options retain their application type.
	yield* app.trpc({ actor: 1 }).userCount();
	// @ts-expect-error Unknown models remain rejected.
	void app.db.Movie;
	// @ts-expect-error Database filters retain generated field types.
	app.db.AuthUser.where({ email: 123 });
	// @ts-expect-error Harness extensions do not widen unknown properties.
	void app.missing;
});
