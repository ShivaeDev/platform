import { Cause, Context, Effect, Exit, Logger, References } from "effect";

export interface FakeDatabase {
	readonly committed: readonly string[];
	readonly name: string;
	readonly transaction: <TValue, E, R>(body: Effect.Effect<TValue, E, R>) => Effect.Effect<TValue, E, R>;
	readonly write: (row: string) => Effect.Effect<void>;
}

export class Current extends Context.Service<Current, FakeDatabase>()("test/Current") {}

const Staging = Context.Reference<ReadonlyMap<FakeDatabase, string[]>>("test/Staging", { defaultValue: () => new Map() });

export function makeDatabase(name: string, commit: Effect.Effect<void> = Effect.void): FakeDatabase {
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
}

export interface Change {
	readonly domain: string;
	readonly subject: string;
}

export function change(subject: string, domain = "orders"): Change {
	return { domain, subject };
}

export interface LogEntry {
	readonly annotations: Readonly<Record<string, unknown>>;
	readonly cause: string;
	readonly level: string;
	readonly message: unknown;
}

export function captureLogs() {
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
}

export function on(database: FakeDatabase) {
	return <TValue, E, R>(effect: Effect.Effect<TValue, E, R>): Effect.Effect<TValue, E, Exclude<R, Current>> =>
		Effect.provideService(effect, Current, database);
}
