import { Deferred, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { advisoryXactLock } from "#advisoryXactLock.ts";
import { transact } from "#transact.ts";
import { Rejected } from "./postgresTransact.ts";

export const holdAdvisoryLock = Effect.fnUntraced(function* (key: bigint | string) {
	const sql = yield* SqlClient.SqlClient;
	const entered = yield* Deferred.make<number>();
	const release = yield* Deferred.make<boolean>();
	const fiber = yield* Effect.gen(function* () {
		yield* advisoryXactLock(key);
		const [backend] = yield* sql<{ pid: number }>`select pg_backend_pid() as pid`;
		if (backend === undefined) {
			return yield* Effect.die("PostgreSQL did not return a backend PID");
		}
		yield* Deferred.succeed(entered, backend.pid);
		if (yield* Deferred.await(release)) {
			return yield* new Rejected();
		}
	}).pipe(transact({ onSqlError: (error) => error }), Effect.forkScoped);
	const pid = yield* Deferred.await(entered).pipe(Effect.timeout("3 seconds"));
	return {
		commit: Deferred.succeed(release, false),
		fiber,
		pid,
		rollback: Deferred.succeed(release, true),
	};
});
