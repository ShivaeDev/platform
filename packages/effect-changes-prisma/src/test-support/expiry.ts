import { Cause, Clock, type Duration, Effect, Exit } from "effect";
import { type PrismaError, TransactionExpired } from "#error.ts";
import type { PrismaClient } from "#test/generated/client.ts";
import type { makeChanges } from "./changes.ts";

export type Changes = ReturnType<typeof makeChanges>["changes"];

export type HarnessTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export function createOrder(changes: Changes, id: string) {
	return changes.use((db) => db.order.create({ data: { id, ownerId: "ada", total: 1 } }));
}

export function warm(client: PrismaClient) {
	return Effect.promise(() => client.$queryRawUnsafe("select 1"));
}

export function probe(duration: Duration.Input) {
	const state = { interrupted: false, sideEffects: 0 };
	return {
		body: <A, E, R>(write: Effect.Effect<A, E, R>) =>
			Effect.gen(function* () {
				yield* write;
				yield* Effect.sleep(duration);
				state.sideEffects += 1;
			}).pipe(
				Effect.onInterrupt(() =>
					Effect.sync(() => {
						state.interrupted = true;
					}),
				),
			),
		state,
	};
}

export const timed = Effect.fn("ChangesPrisma.timed")(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
	const started = yield* Clock.currentTimeMillis;
	const result = yield* effect;
	return { elapsed: (yield* Clock.currentTimeMillis) - started, result };
});

export const harnessed = Effect.fn("ChangesPrisma.harnessed")(function* <TX, E>(changes: Changes, body: Effect.Effect<TX, E>) {
	const context = yield* Effect.context<never>();
	const exits: Exit.Exit<TX, E | TransactionExpired | PrismaError>[] = [];
	async function run(tx: HarnessTx) {
		exits.push(await Effect.runPromiseExitWith(context)(changes.transaction(body).pipe(Effect.provideService(changes.Client, tx))));
	}
	return { exits, run };
});

export function expiredIn(exits: readonly Exit.Exit<unknown, unknown>[]) {
	const [exit] = exits;
	return exit !== undefined && Exit.isFailure(exit) && Cause.squash(exit.cause) instanceof TransactionExpired;
}
