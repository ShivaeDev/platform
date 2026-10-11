import { type Context, Effect, Exit } from "effect";
import type { Frame } from "@shivaedev/effect-changes/frame.ts";
import { PrismaError, TransactionExpired } from "./error.ts";
import { type Expire, expiring, isTransactionClosed } from "./expiry.ts";
import type { Transactional, TransactionOptions } from "./model.ts";

interface Settled<TX, E> {
	readonly closed?: TransactionExpired;
	readonly committed: boolean;
	readonly exit: Exit.Exit<TX, E | TransactionExpired | PrismaError>;
}

class BodyFailed {}

function commit<TTx extends Transactional<TTx>, TX, E, R>(
	client: TTx,
	options: TransactionOptions | undefined,
	savepoint: boolean,
	body: (tx: TTx) => Effect.Effect<TX, E, R>,
	context: Context.Context<R>,
	signal: AbortSignal,
): Promise<Settled<TX, E>> {
	let started = false;
	let failed: Exit.Exit<TX, E> | undefined;
	async function run(tx: TTx) {
		started = true;
		const exit = await Effect.runPromiseExitWith(context)(body(tx), { signal });
		if (Exit.isSuccess(exit)) {
			return exit.value;
		}
		failed = exit;
		throw new BodyFailed();
	}
	function rejected(cause: unknown): Settled<TX, E> {
		if (failed !== undefined) {
			return { committed: false, exit: failed };
		}
		if (!(isTransactionClosed(cause) && (started || savepoint))) {
			return { committed: false, exit: Exit.fail(new PrismaError({ cause })) };
		}
		const closed = new TransactionExpired({ cause, message: "The transaction was closed before it could finish" });
		return { closed, committed: false, exit: Exit.fail(closed) };
	}
	return Promise.resolve(client.$transaction(run, options)).then(
		(value): Settled<TX, E> => ({ committed: true, exit: Exit.succeed(value) }),
		rejected,
	);
}

export const runTransaction = <TTx extends Transactional<TTx>, TX, E, R, TOpenRequirements>(options: {
	readonly client: TTx;
	readonly open: Effect.Effect<Frame, never, TOpenRequirements>;
	readonly body: (tx: TTx) => Effect.Effect<TX, E, R>;
	readonly transaction: TransactionOptions | undefined;
	readonly savepoint: boolean;
	readonly deadline: number | undefined;
	readonly Expiry: Context.Reference<Expire>;
}): Effect.Effect<TX, E | TransactionExpired | PrismaError, R | TOpenRequirements> =>
	Effect.uninterruptibleMask((restore) =>
		Effect.gen(function* () {
			const { client, savepoint, body, deadline, Expiry } = options;
			const frame = yield* options.open;
			const context = yield* Effect.context<R>();
			const abort = new AbortController();
			function guarded(tx: TTx) {
				return expiring(frame.provide(body(tx)), deadline, Expiry);
			}
			const outcome = commit(client, options.transaction, savepoint, guarded, context, abort.signal);
			const expire = yield* Expiry;
			function settle(settled: Settled<TX, E | TransactionExpired>) {
				return Effect.andThen(
					settled.closed === undefined ? Effect.void : expire(settled.closed.cause),
					Effect.as(frame.settle(settled.committed ? "committed" : "rolledBack"), settled.exit),
				);
			}
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
