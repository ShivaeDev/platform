import { Cause, Context, Effect, Exit, Logger, References } from "effect";

export interface FakeDatabase {
	commit: Effect.Effect<void>;
	readonly committed: string[];
	readonly name: string;
	readonly transaction: <TValue, E, R>(body: Effect.Effect<TValue, E, R>) => Effect.Effect<TValue, E, R>;
	readonly write: (row: string) => Effect.Effect<void>;
}

export class Current extends Context.Service<Current, FakeDatabase>()("test/Current") {}

const Staging = Context.Reference<ReadonlyMap<FakeDatabase, string[]>>("test/Staging", { defaultValue: () => new Map() });

const ended = new WeakSet<string[]>();

function openStaging(staging: ReadonlyMap<FakeDatabase, string[]>, database: FakeDatabase) {
	const staged = staging.get(database);
	return staged === undefined || ended.has(staged) ? undefined : staged;
}

export function makeDatabase(name: string): FakeDatabase {
	const database: FakeDatabase = {
		commit: Effect.void,
		committed: [],
		name,
		transaction: (body) =>
			Effect.uninterruptibleMask((restore) =>
				Effect.gen(function* () {
					const staging = yield* Staging;
					const parent = openStaging(staging, database);
					const staged: string[] = [];
					const exit = yield* Effect.exit(restore(Effect.provideService(body, Staging, new Map(staging).set(database, staged))));
					ended.add(staged);
					if (Exit.isSuccess(exit)) {
						if (parent === undefined) {
							yield* database.commit;
						}
						(parent ?? database.committed).push(...staged);
					}
					return yield* exit;
				}),
			),
		write: (row) =>
			Effect.map(Effect.service(Staging), (staging) => {
				(openStaging(staging, database) ?? database.committed).push(row);
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

export function label({ domain, subject }: Change) {
	return `${subject}:${domain}`;
}

export interface LoggedError {
	readonly cause: string;
	readonly changes: unknown;
	readonly channel: unknown;
	readonly message: unknown;
}

export function captureLogs() {
	const errors: LoggedError[] = [];
	const logger = Logger.make((options) => {
		if (options.logLevel !== "Error") {
			return;
		}
		const annotations = options.fiber.getRef(References.CurrentLogAnnotations);
		errors.push({
			cause: Cause.pretty(options.cause),
			changes: annotations.changes,
			channel: annotations.channel,
			message: Array.isArray(options.message) ? options.message.join(" ") : options.message,
		});
	});
	return { errors, layer: Logger.layer([logger]) };
}
