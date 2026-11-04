import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { waitForBlockedSessions } from "@shivaedev/test-sql/server/waitForBlockedSessions.ts";

// The shutdown story sends SIGTERM and asserts the worker remains alive while its job is blocked.
export const holdJob = Effect.fn("DeploymentStory.holdJob")(function* (noteId: number) {
	const sql = yield* SqlClient.SqlClient;
	const connection = yield* sql.reserve;
	yield* Effect.acquireRelease(connection.executeRaw("BEGIN", []), () => connection.executeRaw("ROLLBACK", []).pipe(Effect.orDie));
	yield* connection.executeRaw("SELECT id FROM notes WHERE id = $1 FOR UPDATE", [noteId]);
	const [holder]: readonly { pid: number }[] = yield* connection.executeUnprepared("SELECT pg_backend_pid() AS pid", [], undefined);
	if (holder === undefined) {
		return yield* Effect.die(new Error("Missing note lock holder"));
	}
	return {
		blocked: waitForBlockedSessions(holder.pid, { within: "15 seconds" }),
		release: connection.executeRaw("ROLLBACK", []).pipe(Effect.asVoid),
	};
});
