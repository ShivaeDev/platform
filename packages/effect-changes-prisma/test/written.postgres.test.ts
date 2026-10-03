import { Effect } from "effect";
import { expect } from "vitest";
import { tableWrites, writtenTables } from "../src/index.ts";
import type { PrismaClient } from "./generated/client.ts";
import { connect, integration, makeDatabase } from "./support/database.ts";

type Transaction = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const backend = async (tx: Transaction) => {
	const [row] = await tx.$queryRawUnsafe<ReadonlyArray<{ readonly pid: number }>>("select pg_backend_pid() as pid");
	return row?.pid;
};

const reusedConnection = <X>(later: (tx: Transaction) => Promise<X>) =>
	Effect.gen(function* () {
		const { schema } = yield* makeDatabase;
		const client = yield* connect(schema, { max: 1 });
		const earlier = yield* Effect.promise(() =>
			client.$transaction(async (tx) => {
				await tx.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } });
				await tx.membership.create({ data: { id: "m1", memberId: "bob", ownerId: "ada" } });
				return backend(tx);
			}),
		);
		return yield* Effect.promise(() =>
			client.$transaction(async (tx) => {
				const since = await Effect.runPromise(tableWrites(tx));
				const result = await later(tx);
				return {
					cumulative: await Effect.runPromise(writtenTables(tx)),
					earlier,
					later: await backend(tx),
					result,
					written: await Effect.runPromise(writtenTables(tx, since)),
				};
			}),
		);
	});

integration("writtenTables leaves out what earlier transactions wrote on a reused connection", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { earlier, later, cumulative, written } = yield* reusedConnection(() => Promise.resolve());
				expect(later).toBe(earlier);
				expect(cumulative).toEqual(["changes_prisma_membership", "changes_prisma_order"]);
				expect(written).toEqual([]);
			}),
		),
	),
);

integration("writtenTables still reports a table the transaction wrote after its baseline, even one an earlier transaction wrote", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { earlier, later, written } = yield* reusedConnection((tx) => tx.order.create({ data: { id: "o2", ownerId: "bob", total: 2 } }));
				expect(later).toBe(earlier);
				expect(written).toEqual(["changes_prisma_order"]);
			}),
		),
	),
);
