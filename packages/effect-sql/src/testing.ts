import { Data, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { TransactionCheckpoint } from "./TransactionCheckpoint.ts";
import { ChangeObserver, transact } from "./transact.ts";

export class UnannouncedWrites extends Data.TaggedError("UnannouncedWrites")<{ readonly tables: readonly string[] }> {}

interface TableWrites {
	readonly relid: number;
	readonly relname: string;
	readonly writes: number;
}

export const withChangeCoverage = Effect.fn("Changes.withChangeCoverage")(function* <A, E, R>(body: Effect.Effect<A, E, R>) {
	const observer = yield* ChangeObserver;
	const sql = yield* SqlClient.SqlClient;
	const named = new Set<unknown>();
	const rolledBack = new Map<number, number>();
	const written = sql<TableWrites>`select relid, relname, (n_tup_ins + n_tup_upd + n_tup_del)::int as writes from pg_stat_xact_user_tables`;
	const checkpoint = Effect.gen(function* () {
		const before = new Map((yield* written).map((row) => [row.relid, row.writes]));
		const previousNames = [...named];
		const previousRollbacks = new Map(rolledBack);
		return Effect.gen(function* () {
			const after = yield* written;
			named.clear();
			for (const key of previousNames) {
				named.add(key);
			}
			rolledBack.clear();
			for (const row of after) {
				rolledBack.set(row.relid, (previousRollbacks.get(row.relid) ?? 0) + row.writes - (before.get(row.relid) ?? 0));
			}
		}).pipe(Effect.orDie);
	}).pipe(Effect.orDie);
	const checked = Effect.gen(function* () {
		const before = new Map((yield* written).map((row) => [row.relid, row.writes]));
		const result = yield* body.pipe(Effect.provideService(TransactionCheckpoint, checkpoint));
		const missing = (yield* written).filter(
			(row) => row.writes > (before.get(row.relid) ?? 0) + (rolledBack.get(row.relid) ?? 0) && !named.has(row.relname),
		);
		if (missing.length > 0) {
			return yield* Effect.fail(new UnannouncedWrites({ tables: missing.map((row) => row.relname).sort() }));
		}
		return result;
	});
	return yield* checked.pipe(
		transact({ onSqlError: (error) => error }),
		Effect.provideService(ChangeObserver, (event) => {
			if (event._tag === "Recorded") {
				for (const key of event.changes) {
					named.add(key);
				}
			}
			return observer(event);
		}),
	);
});
