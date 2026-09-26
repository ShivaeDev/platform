import type { Frame } from "@shivaedev/effect-changes";
import { type Context, Effect, Exit } from "effect";
import { PrismaError } from "./error.ts";
import type { Transactional, TransactionOptions } from "./model.ts";

interface Settled<X, E> {
	readonly committed: boolean;
	readonly exit: Exit.Exit<X, E | PrismaError>;
}

class BodyFailed {}

const commit = <Tx extends Transactional<Tx>, X, E, R>(
	client: Tx,
	options: TransactionOptions | undefined,
	body: (tx: Tx) => Effect.Effect<X, E, R>,
	context: Context.Context<R>,
	signal: AbortSignal,
): Promise<Settled<X, E>> => {
	let failed: Exit.Exit<X, E> | undefined;
	const run = async (tx: Tx) => {
		const exit = await Effect.runPromiseExitWith(context)(body(tx), { signal });
		if (Exit.isSuccess(exit)) return exit.value;
		failed = exit;
		throw new BodyFailed();
	};
	return Promise.resolve(client.$transaction(run, options)).then(
		(value): Settled<X, E> => ({ committed: true, exit: Exit.succeed(value) }),
		(cause: unknown): Settled<X, E> => ({ committed: false, exit: failed ?? Exit.fail(new PrismaError({ cause })) }),
	);
};

export const runTransaction = <Tx extends Transactional<Tx>, X, E, R, RO>(options: {
	readonly client: Tx;
	readonly open: Effect.Effect<Frame, never, RO>;
	readonly body: (tx: Tx) => Effect.Effect<X, E, R>;
	readonly transaction: TransactionOptions | undefined;
}): Effect.Effect<X, E | PrismaError, R | RO> =>
	Effect.uninterruptibleMask((restore) =>
		Effect.gen(function* () {
			const { client, body } = options;
			const frame = yield* options.open;
			const context = yield* Effect.context<R>();
			const abort = new AbortController();
			const outcome = commit(client, options.transaction, (tx) => frame.provide(body(tx)), context, abort.signal);
			const settle = (settled: Settled<X, E>) => Effect.as(frame.settle(settled.committed ? "committed" : "rolledBack"), settled.exit);
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
