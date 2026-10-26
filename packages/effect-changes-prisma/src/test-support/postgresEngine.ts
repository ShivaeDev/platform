import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import type { BeforeCommit } from "@shivaedev/changes/channel.ts";
import { tablesOf } from "#tables.ts";
import { type Change, label, makeChanges } from "./changes.ts";
import { type ConnectOptions, connect, makeDatabase, orderIds } from "./database.ts";

export interface PostgresOptions extends ConnectOptions {
	readonly beforeCommit?: BeforeCommit<Change>;
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
	const checked: { changes: readonly string[]; committed: readonly string[] }[] = [];
	const beforeCommit = options.beforeCommit;
	const binding = makeChanges(
		client,
		() => (options.observeCommitted ? Effect.map(orderIds(database.observer), (ids) => void seen.push(ids)) : Effect.void),
		options.mappingError,
		beforeCommit === undefined
			? undefined
			: (batch) =>
					Effect.gen(function* () {
						const committed = yield* orderIds(database.observer);
						checked.push({ changes: batch.map(label), committed });
						yield* beforeCommit(batch);
					}),
	);
	return { ...database, ...binding, checked, client, current, seen, tables };
});

export type PostgresEngine = Effect.Success<ReturnType<typeof postgresEngine>>;
