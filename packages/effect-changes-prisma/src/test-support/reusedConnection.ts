import { Effect } from "effect";
import { tableWrites, writtenTables } from "#tables.ts";
import type { PrismaClient } from "#test/generated/client.ts";
import type { HarnessTx } from "./expiry.ts";

async function backend(tx: HarnessTx) {
	const [row] = await tx.$queryRawUnsafe<ReadonlyArray<{ readonly pid: number }>>("select pg_backend_pid() as pid");
	return row?.pid;
}

export function reusedConnection<A>(client: PrismaClient, later: (tx: HarnessTx) => Promise<A>) {
	return Effect.promise(async () => {
		const earlier = await client.$transaction(async (tx) => {
			await tx.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } });
			await tx.membership.create({ data: { id: "m1", memberId: "bob", ownerId: "ada" } });
			return backend(tx);
		});
		return client.$transaction(async (tx) => {
			const since = await Effect.runPromise(tableWrites(tx));
			const result = await later(tx);
			return {
				cumulative: await Effect.runPromise(writtenTables(tx)),
				earlier,
				later: await backend(tx),
				result,
				written: await Effect.runPromise(writtenTables(tx, since)),
			};
		});
	});
}
