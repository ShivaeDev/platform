import { Cause, Clock, type Duration, Effect, Exit } from "effect";
import { type PrismaError, TransactionExpired } from "../../src/index.ts";
import type { PrismaClient } from "../generated/client.ts";
import type { makeChanges } from "./changes.ts";

export type Changes = ReturnType<typeof makeChanges>["changes"];

export type HarnessTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export const createOrder = (changes: Changes, id: string) => changes.use((db) => db.order.create({ data: { id, ownerId: "ada", total: 1 } }));

export const warm = (client: PrismaClient) => Effect.promise(() => client.$queryRawUnsafe("select 1"));

export const probe = (duration: Duration.Input) => {
	const state = { sideEffects: 0, interrupted: false };
	return {
		state,
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
	};
};

export const timed = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.gen(function* () {
		const started = yield* Clock.currentTimeMillis;
		const result = yield* effect;
		return { result, elapsed: (yield* Clock.currentTimeMillis) - started };
	});

export const harnessed = <X, E>(changes: Changes, body: Effect.Effect<X, E>) =>
	Effect.gen(function* () {
		const context = yield* Effect.context<never>();
		const exits: Array<Exit.Exit<X, E | TransactionExpired | PrismaError>> = [];
		const run = async (tx: HarnessTx) => {
			exits.push(await Effect.runPromiseExitWith(context)(changes.transaction(body).pipe(Effect.provideService(changes.Client, tx))));
		};
		return { exits, run };
	});

export const expiredIn = (exits: ReadonlyArray<Exit.Exit<unknown, unknown>>) => {
	const [exit] = exits;
	return exit !== undefined && Exit.isFailure(exit) && Cause.squash(exit.cause) instanceof TransactionExpired;
};
