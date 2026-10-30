import { Deferred, Effect, type Fiber } from "effect";
import { SqlClient } from "effect/sql";
import { RecordedLogs } from "./RecordedLogs.ts";

export type Applied = ReadonlyArray<readonly [id: number, name: string]>;

export interface MigrationEngine {
	readonly bodiesRun: string[];
	readonly firstRunStarted: { at: number | undefined };
	readonly lockTimeouts: string[];
	readonly logs: RecordedLogs["Service"];
	readonly pause: { readonly entered: Deferred.Deferred<void>; readonly resume: Deferred.Deferred<void> };
	paused: Fiber.Fiber<Applied | string> | undefined;
	readonly releasesSeenByComponents: string[];
	readonly runs: Array<Applied | string>;
	readonly sql: SqlClient.SqlClient;
	readonly tables: { readonly audit: string; readonly ledger: string; readonly orders: string };
	readonly verdicts: string[];
}

export const migrationEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const prefix = `migration_${crypto.randomUUID().replaceAll("-", "")}`;
	const tables = { audit: `${prefix}_audit`, ledger: `${prefix}_ledger`, orders: `${prefix}_orders` };
	yield* Effect.addFinalizer(() =>
		Effect.forEach(
			[tables.audit, tables.orders, tables.ledger, `${tables.ledger}_release`, `${tables.ledger}_workers`],
			(name) => sql`drop table if exists ${sql(name)}`,
		).pipe(Effect.orDie),
	);
	const engine: MigrationEngine = {
		bodiesRun: [],
		firstRunStarted: { at: undefined },
		lockTimeouts: [],
		logs: yield* RecordedLogs,
		pause: { entered: yield* Deferred.make<void>(), resume: yield* Deferred.make<void>() },
		paused: undefined,
		releasesSeenByComponents: [],
		runs: [],
		sql,
		tables,
		verdicts: [],
	};
	return engine;
});
