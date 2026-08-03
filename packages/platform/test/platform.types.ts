import { makeDatabase } from "@shivaedev/effect-prisma";
import { makeEffectTRPC, makeRequestServices } from "@shivaedev/effect-trpc";
import { initTRPC } from "@trpc/server";
import { Effect, Layer, ManagedRuntime } from "effect";
import { expectTypeOf } from "vitest";
import {
	type Contract,
	contractJson,
} from "../../effect-prisma/test/contract.js";
import { makePlatformIt } from "../src/testing.js";

type IsAny<Value> = 0 extends 1 & Value ? true : false;

const Database = makeDatabase<Contract>("@types/PlatformDatabase", {
	contractJson,
});
const DatabaseLive = Database.layer({ url: "postgresql://compile-only" });
const runtime = ManagedRuntime.make(DatabaseLive);
const adapter = makeEffectTRPC({ runtime });
const t = initTRPC.context<{ readonly actor: string }>().create();
const procedure = adapter.procedure(
	t.procedure,
	makeRequestServices(() => Layer.empty),
);
const router = t.router({
	userCount: procedure.query(function* () {
		const db = yield* Database;
		return yield* db.User.count();
	}),
});

const it = makePlatformIt(Database)({
	adapter,
	createCaller: (options = { actor: "default" }) =>
		router.createCaller(options),
	layer: DatabaseLive,
	extend: () => Effect.succeed({ fixtureName: "typed" as const }),
});

it.effectApp(
	"preserves database, caller, and extension types",
	function* (app) {
		const databaseIsAny: IsAny<typeof app.db> = false;
		const callerIsAny: IsAny<typeof app.trpc> = false;
		expectTypeOf(app).not.toBeAny();
		expectTypeOf(app.db).not.toBeAny();
		expectTypeOf(app.trpc).not.toBeAny();
		expectTypeOf(app.fixtureName).toEqualTypeOf<"typed">();

		const count = yield* app.trpc.userCount();
		expectTypeOf(count).toEqualTypeOf<number>();
		expectTypeOf(count).not.toBeAny();

		const users = yield* app.db.User.where({ name: "Ada" });
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
		app.db.Movie;
		// @ts-expect-error Database filters retain generated field types.
		app.db.User.where({ email: 123 });
		// @ts-expect-error Harness extensions do not widen unknown properties.
		app.missing;
	},
);
