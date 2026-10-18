import { Effect } from "effect";
import { makeEffectTRPC } from "@shivaedev/effect-trpc/adapter.ts";
import { effectPrismaAdapter } from "#better-auth/adapter.ts";
import { makePlatformRuntime } from "#runtime/make.ts";
import { Database, DatabaseLive } from "./database.ts";
export const authEngine = Effect.fnUntraced(function* () {
	const db = yield* Database;
	const services = yield* Effect.context<Effect.Services<typeof Database>>();
	const runtime = makePlatformRuntime(DatabaseLive);
	yield* Effect.addFinalizer(() => Effect.promise(() => runtime.dispose()));
	const adapter = makeEffectTRPC({ runtime });
	const factory = effectPrismaAdapter(Database, runtime, {
		modelName: (model) => `Auth${model.length === 0 ? model : `${model[0]?.toUpperCase()}${model.slice(1)}`}`,
	});
	const authDatabase = factory({});
	return { adapter, authDatabase, db, runtime, services };
});
