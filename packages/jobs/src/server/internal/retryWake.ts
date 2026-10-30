import { Clock, Effect } from "effect";
import { redactDiagnosticCause } from "@shivaedev/errors/redactCause.ts";
import type { PgBossClient } from "#client.ts";
import { toPgBossError } from "#error.ts";

export function retryWake(client: PgBossClient, name: string, id: string, registration: Promise<string>): Effect.Effect<void> {
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
		const workId = yield* Effect.tryPromise({ catch: (error) => toPgBossError("register", error, name), try: () => registration });
		// Host timers can fire early; PostgreSQL retains precision that Date drops.
		const deadline = job.startAfter.getTime() + 1;
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
