import { Cause, Effect, Exit } from "effect";
import type { Job } from "pg-boss";
import type { PgBossClient } from "#client.ts";

function failureOutput(cause: Cause.Cause<unknown>): object {
	const error = Cause.squash(cause);
	return typeof error === "object" && error !== null ? error : { message: String(error) };
}

export function batchHandler(client: PgBossClient, name: string, run: (job: Job<unknown>) => Effect.Effect<unknown, unknown>) {
	const complete = client.complete?.bind(client);
	const fail = client.fail?.bind(client);
	if (complete === undefined || fail === undefined) {
		throw new TypeError("This pg-boss client does not support complete and fail");
	}
	return async (jobs: readonly Job<unknown>[]): Promise<void> => {
		for (const job of jobs) {
			const exit = await Effect.runPromiseExit(
				Effect.suspend(() => run(job)),
				{ signal: job.signal },
			);
			if (job.signal.aborted || (Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause))) {
				// Returning would let pg-boss complete the unprocessed jobs; its expiry owns them instead.
				return new Promise<never>(() => undefined);
			}
			if (Exit.isSuccess(exit)) {
				await complete(name, job);
			} else {
				await fail(name, job, failureOutput(exit.cause));
			}
		}
	};
}
