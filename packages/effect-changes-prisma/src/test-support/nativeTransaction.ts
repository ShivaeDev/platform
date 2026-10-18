import { Effect, Option } from "effect";
import type { PrismaClient } from "#test/generated/client.ts";
import type { PostgresEngine } from "./postgresEngine.ts";

export type NativeTransaction = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export const nativeTransaction = Effect.fn("PrismaStory.nativeTransaction")(function* <A, E>(
	engine: PostgresEngine,
	body: (tx: NativeTransaction) => Effect.Effect<A, E>,
	rollback = false,
) {
	const context = yield* Effect.context<never>();
	const marker = new Error("The story rolls back its native transaction");
	let result = Option.none<A>();
	return yield* Effect.promise(() =>
		engine.client
			.$transaction(async (tx) => {
				const value = await Effect.runPromiseWith(context)(body(tx).pipe(Effect.provideService(engine.changes.Client, tx)));
				if (!rollback) {
					return value;
				}
				result = Option.some(value);
				throw marker;
			})
			.catch((error: unknown) => {
				if (error !== marker) {
					throw error;
				}
				return Option.getOrThrow(result);
			}),
	);
});
