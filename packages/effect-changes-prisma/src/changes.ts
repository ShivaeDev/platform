import { Cause, Context, Effect, Exit, Option } from "effect";
import { type Channel, type ChannelOptions, makeChannel } from "@shivaedev/effect-changes/channel.ts";
import { PrismaError, type TransactionExpired } from "./error.ts";
import { configuredTimeout, type Expire, isTransactionClient, isTransactionClosed, makeExpiry, unlinked } from "./expiry.ts";
import type { ChangeMap, Transactional, TransactionOptions } from "./model.ts";
import { delegatesOf, recordingClient } from "./recording.ts";
import { runTransaction } from "./transaction.ts";
import { interpret, type LooseMap, type UnnamedWrite, type Write } from "./write.ts";

export type UnnamedObserver = (write: UnnamedWrite) => Effect.Effect<void>;

export interface PrismaChangesOptions<Tx, A, R> extends Omit<ChannelOptions<A, R>, "owner" | "unowned"> {
	readonly client: Tx & Transactional<Tx>;
	readonly models: Partial<ChangeMap<Tx, A>>;
}

export interface PrismaChanges<Tx, A, R> {
	readonly Client: Context.Reference<Tx>;
	readonly channel: Channel<A, R>;
	readonly recordWrite: (write: Write) => Effect.Effect<void, never, R>;
	readonly transaction: <X, E, R2>(
		body: Effect.Effect<X, E, R2>,
		options?: TransactionOptions,
	) => Effect.Effect<X, E | TransactionExpired | PrismaError, R | R2>;
	readonly Unnamed: Context.Reference<UnnamedObserver>;
	readonly use: <X>(query: (client: Tx) => PromiseLike<X>) => Effect.Effect<X, PrismaError, R>;
}

const ignoreUnnamed: UnnamedObserver = () => Effect.void;

function expireOnClosed(Expiry: Context.Reference<Expire>, exit: Exit.Exit<unknown, PrismaError>): Effect.Effect<void> {
	return Option.match(Exit.isFailure(exit) ? Cause.findErrorOption(exit.cause) : Option.none(), {
		onNone: () => Effect.void,
		onSome: ({ cause }) => (isTransactionClosed(cause) ? Effect.flatMap(Effect.service(Expiry), (expire) => expire(cause)) : Effect.void),
	});
}

export const makePrismaChanges = <Tx extends Transactional<Tx>, A, R = never>(options: PrismaChangesOptions<Tx, A, R>): PrismaChanges<Tx, A, R> => {
	const { client, models: typed, ...channelOptions } = options;
	const models: LooseMap<A> = typed;
	const prefix = `@shivaedev/effect-changes-prisma/${options.name}/${crypto.randomUUID()}`;
	const channel = makeChannel<A, R>({ ...channelOptions, owner: Effect.succeed(client) });
	const Client = Context.Reference<Tx>(`${prefix}/Client`, { defaultValue: () => client });
	const Unnamed = Context.Reference<UnnamedObserver>(`${prefix}/Unnamed`, { defaultValue: () => ignoreUnnamed });
	const Expiry = makeExpiry(`${prefix}/Expiry`);
	const delegates = delegatesOf(models);

	const recordWrite = Effect.fn("PrismaChanges.recordWrite")(function* (write: Write) {
		const { changes, unnamed } = interpret(models, write);
		if (unnamed !== undefined) {
			yield* Effect.flatMap(Effect.service(Unnamed), (observe) => observe(unnamed));
		}
		if (changes.length > 0) {
			yield* channel.record(changes);
		}
	});

	const use = Effect.fn("PrismaChanges.use")(function* <X>(query: (client: Tx) => PromiseLike<X>) {
		const current = yield* Client;
		const writes: Write[] = [];
		const recording = recordingClient(current, delegates, (write) => writes.push(write));
		const exit = yield* Effect.exit(Effect.tryPromise({ catch: (cause) => new PrismaError({ cause }), try: () => query(recording) }));
		yield* Effect.forEach(writes, recordWrite, { discard: true });
		yield* expireOnClosed(Expiry, exit);
		return yield* exit;
	}, Effect.uninterruptible);

	const transaction = <X, E, R2>(body: Effect.Effect<X, E, R2>, transactionOptions?: TransactionOptions) =>
		Effect.flatMap(Effect.service(Client), (current) => {
			const savepoint = isTransactionClient(current);
			const run = runTransaction({
				body: (tx: Tx) => Effect.provideService(body, Client, tx),
				client: current,
				deadline: savepoint ? undefined : (transactionOptions?.timeout ?? configuredTimeout(current)),
				Expiry,
				open: channel.open,
				savepoint,
				transaction: transactionOptions,
			});
			return savepoint ? run : Effect.provideService(run, Expiry, unlinked);
		}).pipe(Effect.withSpan("PrismaChanges.transaction"));

	return { Client, channel, recordWrite, transaction, Unnamed, use };
};
