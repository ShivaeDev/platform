import { Clock, Effect, type Scope } from "effect";
import type { Job, WorkOptions } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { batchHandler } from "#internal/batchHandler.ts";

export function registerWorker(
	client: PgBossClient,
	name: string,
	options: WorkOptions,
	run: (job: Job<unknown>) => Effect.Effect<unknown, unknown>,
	scope: Scope.Scope,
): Promise<string> {
	const worker = client.work(
		name,
		{ ...options, includeMetadata: true },
		batchHandler(client, name, run, async (attempt) => {
			if (client.findJobs === undefined || client.notifyWorker === undefined) {
				return;
			}
			const job = (await client.findJobs(name, { id: attempt.id }))[0];
			if (job?.state !== "retry") {
				return;
			}
			const id = await worker;
			await Effect.runPromise(
				Effect.gen(function* () {
					const now = yield* Clock.currentTimeMillis;
					// PostgreSQL timestamps retain sub-millisecond precision that Date drops.
					yield* Effect.sleep(Math.max(0, job.startAfter.getTime() + 1 - now));
					client.notifyWorker?.(id);
				}).pipe(Effect.forkIn(scope)),
			);
		}),
	);
	return worker;
}
