import type { BetterAuthOptions } from "better-auth";
import { Effect } from "effect";
import { makeEffectTRPC } from "@shivaedev/effect-trpc/adapter.ts";
import { type EffectPrismaAdapterOptions, effectPrismaAdapter } from "#better-auth/adapter.ts";
import { makePlatformRuntime } from "#runtime/make.ts";
import { Database, DatabaseLive } from "./database.ts";
export const authEngine = Effect.fnUntraced(function* () {
	const db = yield* Database;
	const services = yield* Effect.context<Effect.Services<typeof Database>>();
	const runtime = makePlatformRuntime(DatabaseLive);
	yield* Effect.addFinalizer(() => Effect.promise(() => runtime.dispose()));
	const adapter = makeEffectTRPC({ runtime });
	const defaultOptions: EffectPrismaAdapterOptions = {
		modelName: (model) => `Auth${model.length === 0 ? model : `${model[0]?.toUpperCase()}${model.slice(1)}`}`,
	};
	function configure(options: BetterAuthOptions, adapterOptions = defaultOptions) {
		return effectPrismaAdapter(Database, runtime, adapterOptions)(options);
	}
	return { adapter, authDatabase: configure({}), configure, db, runtime, services };
});
