import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { EngineStory } from "#test/engineState.ts";
import { namedAttempt, namedRecord } from "#test/namedCloudHost.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

export function sessionNamingVerbs(state: EngineStory, tell: (line: string) => void) {
	function naming() {
		if (state.recovery.naming === undefined) {
			throw new Error("No session naming journal is configured");
		}
		return state.recovery.naming;
	}
	return {
		acknowledgeNamedSession: (operation: string, session: string) => {
			tell(`acknowledge ${session} for ${operation}`);
			return naming().journal.acknowledgeSession(operation, session);
		},
		changeNamingIntent: (change: "missing" | "ambiguous" | "changed") =>
			Effect.gen(function* () {
				tell(`the acknowledged naming intent becomes ${change}`);
				if (change === "missing") {
					const sql = yield* SqlClient.SqlClient;
					yield* sql`delete from ${sql(`${STORAGE_NAMESPACE}_records`)} where work_id = ${"synthetic-0"}`;
					return;
				}
				const { store } = naming();
				const stored = yield* store.load("synthetic-0");
				if (stored === undefined) {
					return yield* Effect.die("No acknowledged work exists");
				}
				yield* store.compareAndSet(
					"synthetic-0",
					stored.version,
					namedRecord("synthetic-0", change === "ambiguous" ? [namedAttempt("worker"), namedAttempt("worker")] : []),
				);
			}),
		namingLists: () => naming().lists,
		namingLoads: () => [...naming().loads],
		readSessionName: (operation: string) => {
			tell(`read the name of ${operation}`);
			const name = naming().journal.sessionName;
			if (name === undefined) {
				throw new Error("No naming method is available");
			}
			return name(operation);
		},
	};
}
