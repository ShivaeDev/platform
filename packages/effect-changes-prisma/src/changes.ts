import { Cause, Context, Effect, Exit, Option } from "effect";
import { type Channel, type ChannelOptions, makeChannel } from "@shivaedev/changes/channel.ts";
import { PrismaError, type TransactionExpired } from "./error.ts";
import { configuredTimeout, type Expire, isTransactionClient, isTransactionClosed, makeExpiry, unlinked } from "./expiry.ts";
import type { ChangeMap, Transactional, TransactionOptions } from "./model.ts";
import { delegatesOf, recordingClient } from "./recording.ts";
import { runTransaction } from "./transaction.ts";
import { interpret, type LooseMap, type UnnamedWrite, type Write } from "./write.ts";

export type UnnamedObserver = (write: UnnamedWrite) => Effect.Effect<void>;

export interface PrismaChangesOptions<TTx, A, R> extends Omit<ChannelOptions<A, R>, "owner" | "unowned"> {
	readonly client: TTx & Transactional<TTx>;
	readonly models: Partial<ChangeMap<TTx, A>>;
}

export interface PrismaChanges<TTx, A, R> {
	readonly Client: Context.Reference<TTx>;
	readonly channel: Channel<A, R>;
	readonly recordWrite: (write: Write) => Effect.Effect<void, never, R>;
	readonly transaction: <TX, E, TR2>(
		body: Effect.Effect<TX, E, TR2>,
		options?: TransactionOptions,
	) => Effect.Effect<TX, E | TransactionExpired | PrismaError, R | TR2>;
	readonly Unnamed: Context.Reference<UnnamedObserver>;
	readonly use: <TX>(query: (client: TTx) => PromiseLike<TX>) => Effect.Effect<TX, PrismaError, R>;
}

const ignoreUnnamed: UnnamedObserver = () => Effect.void;

function expireOnClosed(Expiry: Context.Reference<Expire>, exit: Exit.Exit<unknown, PrismaError>): Effect.Effect<void> {
	return Option.match(Exit.isFailure(exit) ? Cause.findErrorOption(exit.cause) : Option.none(), {
		onNone: () => Effect.void,
		onSome: ({ cause }) => (isTransactionClosed(cause) ? Effect.flatMap(Effect.service(Expiry), (expire) => expire(cause)) : Effect.void),
	});
}

export function makePrismaChanges<TTx extends Transactional<TTx>, A, R = never>(options: PrismaChangesOptions<TTx, A, R>): PrismaChanges<TTx, A, R> {
	const { client, models: typed, ...channelOptions } = options;
	const models: LooseMap<A> = typed;
	const prefix = `@shivaedev/effect-changes-prisma/${options.name}/${crypto.randomUUID()}`;
	const channel = makeChannel<A, R>({ ...channelOptions, owner: Effect.succeed(client) });
	const Client = Context.Reference<TTx>(`${prefix}/Client`, { defaultValue: () => client });
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

	const use = Effect.fn("PrismaChanges.use")(function* <TX>(query: (client: TTx) => PromiseLike<TX>) {
		const current = yield* Client;
		const writes: Write[] = [];
		const recording = recordingClient(current, delegates, (write) => writes.push(write));
		const exit = yield* Effect.exit(Effect.tryPromise({ catch: (cause) => new PrismaError({ cause }), try: () => query(recording) }));
		yield* Effect.forEach(writes, recordWrite, { discard: true });
		yield* expireOnClosed(Expiry, exit);
		return yield* exit;
	}, Effect.uninterruptible);

	function transaction<TX, E, TR2>(body: Effect.Effect<TX, E, TR2>, transactionOptions?: TransactionOptions) {
		return Effect.flatMap(Effect.service(Client), (current) => {
			const savepoint = isTransactionClient(current);
			const run = runTransaction({
				body: () => body,
				Client,
				client: current,
				deadline: savepoint ? undefined : (transactionOptions?.timeout ?? configuredTimeout(current)),
				Expiry,
				open: channel.open,
				savepoint,
				transaction: transactionOptions,
			});
			return savepoint ? run : Effect.provideService(run, Expiry, unlinked);
		}).pipe(Effect.withSpan("PrismaChanges.transaction"));
	}

	return { Client, channel, recordWrite, transaction, Unnamed, use };
}
