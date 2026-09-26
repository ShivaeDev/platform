import { type Channel, type ChannelOptions, makeChannel } from "@shivaedev/effect-changes";
import { Context, Effect } from "effect";
import { PrismaError } from "./error.ts";
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
	readonly channel: Channel<A, R>;
	readonly Client: Context.Reference<Tx>;
	readonly use: <X>(query: (client: Tx) => PromiseLike<X>) => Effect.Effect<X, PrismaError, R>;
	readonly transaction: <X, E, R2>(body: Effect.Effect<X, E, R2>, options?: TransactionOptions) => Effect.Effect<X, E | PrismaError, R | R2>;
	readonly recordWrite: (write: Write) => Effect.Effect<void, never, R>;
	readonly Unnamed: Context.Reference<UnnamedObserver>;
}

let bindings = 0;

const ignoreUnnamed: UnnamedObserver = () => Effect.void;

export const makePrismaChanges = <Tx extends Transactional<Tx>, A, R = never>(options: PrismaChangesOptions<Tx, A, R>): PrismaChanges<Tx, A, R> => {
	const { client, models: typed, ...channelOptions } = options;
	const models: LooseMap<A> = typed;
	const prefix = `@shivaedev/effect-changes-prisma/${options.name}/${bindings++}`;
	const channel = makeChannel<A, R>({ ...channelOptions, owner: Effect.succeed(client) });
	const Client = Context.Reference<Tx>(`${prefix}/Client`, { defaultValue: () => client });
	const Unnamed = Context.Reference<UnnamedObserver>(`${prefix}/Unnamed`, { defaultValue: () => ignoreUnnamed });
	const delegates = delegatesOf(models);

	const recordWrite = Effect.fn("PrismaChanges.recordWrite")(function* (write: Write) {
		const { changes, unnamed } = interpret(models, write);
		if (unnamed !== undefined) yield* Effect.flatMap(Effect.service(Unnamed), (observe) => observe(unnamed));
		if (changes.length > 0) yield* channel.record(changes);
	});

	const use = Effect.fn("PrismaChanges.use")(function* <X>(query: (client: Tx) => PromiseLike<X>) {
		const current = yield* Client;
		const writes: Array<Write> = [];
		const recording = recordingClient(current, delegates, (write) => writes.push(write));
		const exit = yield* Effect.exit(Effect.tryPromise({ try: () => query(recording), catch: (cause) => new PrismaError({ cause }) }));
		yield* Effect.forEach(writes, recordWrite, { discard: true });
		return yield* exit;
	}, Effect.uninterruptible);

	const transaction = <X, E, R2>(body: Effect.Effect<X, E, R2>, transactionOptions?: TransactionOptions) =>
		Effect.flatMap(Effect.service(Client), (current) =>
			runTransaction({
				client: current,
				open: channel.open,
				body: (tx: Tx) => Effect.provideService(body, Client, tx),
				transaction: transactionOptions,
			}),
		).pipe(Effect.withSpan("PrismaChanges.transaction"));

	return { channel, Client, use, transaction, recordWrite, Unnamed };
};
