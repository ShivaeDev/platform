import type { Frame } from "@shivaedev/effect-changes";
import { type Context, Effect, Exit } from "effect";
import { PrismaError, TransactionExpired } from "./error.ts";
import { type Expire, expiring, isTransactionClosed } from "./expiry.ts";
import type { Transactional, TransactionOptions } from "./model.ts";

interface Settled<X, E> {
	readonly closed?: TransactionExpired;
	readonly committed: boolean;
	readonly exit: Exit.Exit<X, E | TransactionExpired | PrismaError>;
}

class BodyFailed {}

const commit = <Tx extends Transactional<Tx>, X, E, R>(
	client: Tx,
	options: TransactionOptions | undefined,
	savepoint: boolean,
	body: (tx: Tx) => Effect.Effect<X, E, R>,
	context: Context.Context<R>,
	signal: AbortSignal,
): Promise<Settled<X, E>> => {
	let started = false;
	let failed: Exit.Exit<X, E> | undefined;
	const run = async (tx: Tx) => {
		started = true;
		const exit = await Effect.runPromiseExitWith(context)(body(tx), { signal });
		if (Exit.isSuccess(exit)) {
			return exit.value;
		}
		failed = exit;
		throw new BodyFailed();
	};
	const rejected = (cause: unknown): Settled<X, E> => {
		if (failed !== undefined) {
			return { committed: false, exit: failed };
		}
		if (!(isTransactionClosed(cause) && (started || savepoint))) {
			return { committed: false, exit: Exit.fail(new PrismaError({ cause })) };
		}
		const closed = new TransactionExpired({ cause, message: "The transaction was closed before it could finish" });
		return { closed, committed: false, exit: Exit.fail(closed) };
	};
	return Promise.resolve(client.$transaction(run, options)).then(
		(value): Settled<X, E> => ({ committed: true, exit: Exit.succeed(value) }),
		rejected,
	);
};

export const runTransaction = <Tx extends Transactional<Tx>, X, E, R, RO>(options: {
	readonly client: Tx;
	readonly open: Effect.Effect<Frame, never, RO>;
	readonly body: (tx: Tx) => Effect.Effect<X, E, R>;
	readonly transaction: TransactionOptions | undefined;
	readonly savepoint: boolean;
	readonly deadline: number | undefined;
	readonly Expiry: Context.Reference<Expire>;
}): Effect.Effect<X, E | TransactionExpired | PrismaError, R | RO> =>
	Effect.uninterruptibleMask((restore) =>
		Effect.gen(function* () {
			const { client, savepoint, body, deadline, Expiry } = options;
			const frame = yield* options.open;
			const context = yield* Effect.context<R>();
			const abort = new AbortController();
			const guarded = (tx: Tx) => expiring(frame.provide(body(tx)), deadline, Expiry);
			const outcome = commit(client, options.transaction, savepoint, guarded, context, abort.signal);
			const expire = yield* Expiry;
			const settle = (settled: Settled<X, E | TransactionExpired>) =>
				Effect.andThen(
					settled.closed === undefined ? Effect.void : expire(settled.closed.cause),
					Effect.as(frame.settle(settled.committed ? "committed" : "rolledBack"), settled.exit),
				);
			const settled = yield* restore(Effect.promise(() => outcome)).pipe(
				Effect.onInterrupt(() =>
					Effect.andThen(
						Effect.sync(() => abort.abort()),
						Effect.flatMap(
							Effect.promise(() => outcome),
							settle,
						),
					),
				),
			);
			return yield* Effect.flatten(settle(settled));
		}),
	);
