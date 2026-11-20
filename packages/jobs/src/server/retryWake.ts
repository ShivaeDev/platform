import { Clock, Effect } from "effect";
import { redactDiagnosticCause } from "@shivaedev/errors/redactCause.ts";
import { batchClockOffset } from "#server/adapters/batchClockOffset.ts";
import type { PgBossClient } from "#server/adapters/client.ts";
import { type PgBossError, toPgBossError } from "#server/error.ts";

export function retryWake(
	client: PgBossClient,
	schema: string,
	name: string,
	id: string,
	registration: Effect.Effect<string, PgBossError>,
): Effect.Effect<void> {
	return Effect.gen(function* () {
		const findJobs = client.findJobs?.bind(client);
		if (findJobs === undefined || client.notifyWorker === undefined) {
			return;
		}
		const jobs = yield* Effect.tryPromise({ catch: (error) => toPgBossError("settle", error, name), try: () => findJobs(name, { id }) });
		const job = jobs[0];
		if (job?.state !== "retry") {
			return;
		}
		const workId = yield* registration;
		const offset = yield* batchClockOffset(client, schema, name);
		// Host timers can fire early; PostgreSQL retains precision that Date drops.
		const deadline = job.startAfter.getTime() + offset + 1;
		let remaining = deadline - (yield* Clock.currentTimeMillis);
		while (remaining > 0) {
			yield* Effect.sleep(remaining);
			remaining = deadline - (yield* Clock.currentTimeMillis);
		}
		const workerIds = client
			.getWipData?.()
			.filter((worker) => worker.workId === workId)
			.map((worker) => worker.id) ?? [workId];
		for (const workerId of workerIds) {
			client.notifyWorker(workerId);
		}
	}).pipe(Effect.catchCause((cause) => Effect.logError(redactDiagnosticCause(cause))));
}
