import { Cause, Effect, Exit } from "effect";
import { type PrismaError, TransactionExpired } from "#error.ts";
import type { NativeTransaction } from "./nativeTransaction.ts";
import type { PostgresEngine } from "./postgresEngine.ts";

export const nativeExpiry = Effect.fn("PrismaStory.nativeExpiry")(function* <TX, E>(
	engine: Pick<PostgresEngine, "client" | "changes">,
	body: Effect.Effect<TX, E>,
) {
	const { changes, client } = engine;
	const context = yield* Effect.context<never>();
	const exits: Exit.Exit<TX, E | TransactionExpired | PrismaError>[] = [];
	async function run(tx: NativeTransaction) {
		exits.push(await Effect.runPromiseExitWith(context)(changes.transaction(body).pipe(Effect.provideService(changes.Client, tx))));
	}
	yield* Effect.promise(() => client.$transaction(run, { timeout: 100 }).catch(() => undefined));
	return exits;
});

export function expiredIn(exits: readonly Exit.Exit<unknown, unknown>[]) {
	const [exit] = exits;
	return exit !== undefined && Exit.isFailure(exit) && Cause.squash(exit.cause) instanceof TransactionExpired;
}
