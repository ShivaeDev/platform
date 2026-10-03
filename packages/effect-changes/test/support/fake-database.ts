import { Cause, Context, Effect, Exit, Logger, References } from "effect";
import { type ChannelOptions, makeChannel } from "../../src/index.ts";

export interface FakeDatabase {
	readonly committed: readonly string[];
	readonly name: string;
	readonly transaction: <X, E, R>(body: Effect.Effect<X, E, R>) => Effect.Effect<X, E, R>;
	readonly write: (row: string) => Effect.Effect<void>;
}

export class Current extends Context.Service<Current, FakeDatabase>()("test/Current") {}

const Staging = Context.Reference<ReadonlyMap<FakeDatabase, string[]>>("test/Staging", { defaultValue: () => new Map() });

export const makeDatabase = (name: string, commit: Effect.Effect<void> = Effect.void): FakeDatabase => {
	const committed: string[] = [];
	const database: FakeDatabase = {
		committed,
		name,
		transaction: (body) =>
			Effect.uninterruptibleMask((restore) =>
				Effect.gen(function* () {
					const staging = yield* Staging;
					const parent = staging.get(database);
					const staged: string[] = [];
					const exit = yield* Effect.exit(restore(Effect.provideService(body, Staging, new Map(staging).set(database, staged))));
					if (Exit.isSuccess(exit)) {
						if (parent === undefined) {
							yield* commit;
						}
						(parent ?? committed).push(...staged);
					}
					return yield* exit;
				}),
			),
		write: (row) =>
			Effect.map(Effect.service(Staging), (staging) => {
				(staging.get(database) ?? committed).push(row);
			}),
	};
	return database;
};

export interface Change {
	readonly domain: string;
	readonly subject: string;
}

export const change = (subject: string, domain = "orders"): Change => ({ domain, subject });

export const makeTestChannel = (options: Partial<ChannelOptions<Change, Current>> = {}) => {
	const published: Array<readonly string[]> = [];
	const channel = makeChannel<Change, Current>({
		key: (event) => `${event.subject}:${event.domain}`,
		name: "Test",
		owner: Effect.service(Current),
		publish: (changes) => Effect.sync(() => published.push(changes.map((event) => `${event.subject}:${event.domain}`))),
		...options,
	});
	return { channel, published };
};

export interface LogEntry {
	readonly annotations: Readonly<Record<string, unknown>>;
	readonly cause: string;
	readonly level: string;
	readonly message: unknown;
}

export const captureLogs = () => {
	const entries: LogEntry[] = [];
	const logger = Logger.make((options) => {
		entries.push({
			annotations: options.fiber.getRef(References.CurrentLogAnnotations),
			cause: Cause.pretty(options.cause),
			level: options.logLevel,
			message: options.message,
		});
	});
	return { entries, layer: Logger.layer([logger]) };
};

export const on =
	(database: FakeDatabase) =>
	<X, E, R>(effect: Effect.Effect<X, E, R>): Effect.Effect<X, E, Exclude<R, Current>> =>
		Effect.provideService(effect, Current, database);

export const harness = (options: Partial<ChannelOptions<Change, Current>> = {}) => {
	const { channel, published } = makeTestChannel(options);
	const inTransaction =
		(database: FakeDatabase) =>
		<X, E, R>(body: Effect.Effect<X, E, R>) =>
			on(database)(channel.within(database.transaction)(body));
	const write = (database: FakeDatabase, row: string, ...changes: readonly Change[]) =>
		on(database)(Effect.andThen(database.write(row), channel.record(changes)));
	return { channel, inTransaction, published, write };
};
