import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import { tablesOf } from "#tables.ts";
import { makeChanges } from "./changes.ts";
import { type ConnectOptions, connect, makeDatabase, orderIds } from "./database.ts";

export interface PostgresOptions extends ConnectOptions {
	readonly currentTimeout?: number;
	readonly mappingError?: Error;
	readonly observeCommitted?: boolean;
}

export const postgresEngine = Effect.fn("PrismaStory.postgresEngine")(function* (options: PostgresOptions) {
	const database = yield* makeDatabase;
	const tables = tablesOf(yield* Effect.promise(() => readFile(new URL("./prisma/schema.prisma", import.meta.url), "utf8")));
	const client = yield* connect(database.schema, options);
	yield* Effect.promise(() => client.$queryRawUnsafe("select 1"));
	const current = options.currentTimeout === undefined ? client : yield* connect(database.schema, { timeout: options.currentTimeout });
	const seen: Array<readonly string[]> = [];
	const binding = makeChanges(
		client,
		() => (options.observeCommitted ? Effect.map(orderIds(database.observer), (ids) => void seen.push(ids)) : Effect.void),
		options.mappingError,
	);
	return { ...database, ...binding, client, current, seen, tables };
});

export type PostgresEngine = Effect.Success<ReturnType<typeof postgresEngine>>;
