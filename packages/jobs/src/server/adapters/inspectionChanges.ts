import { Effect } from "effect";
import { inspectionChannel } from "#server/adapters/inspectionPlan.ts";
import type { PgBossClient } from "#server/client.ts";
import { toPgBossError } from "#server/error.ts";
import { queueSignal } from "./queueSignal.ts";

export const inspectionChanges = Effect.fnUntraced(function* (client: PgBossClient, schema: string, queue?: string) {
	const signal = queueSignal();
	yield* Effect.acquireRelease(
		Effect.tryPromise({
			catch: (error) => toPgBossError("inspect", error, queue),
			try: () => {
				const db = client.getDb?.();
				if (db?.listen === undefined) {
					throw new TypeError("This pg-boss client does not support listen");
				}
				return db.listen(
					inspectionChannel(schema),
					(name) => {
						if (queue === undefined || name === queue) {
							signal.changed();
						}
					},
					signal.changed,
				);
			},
		}),
		(listener) => Effect.promise(() => listener.close()),
	);
	return { revision: signal.revision, waitForChange: signal.waitForChange };
});
