import { type Cause, Effect } from "effect";
import { redactDiagnosticCause } from "@shivaedev/errors/redactCause.ts";
import type { WorkerJob } from "#server/job.ts";

function attemptLogged(name: string, job: WorkerJob<unknown>, outcome: "deadline" | "failed", line: Effect.Effect<void>) {
	return Effect.annotateLogs(line, { "job.attempt": job.retryCount + 1, "job.id": job.id, "job.outcome": outcome, "job.queue": name });
}

export function deadlineLogged(name: string, job: WorkerJob<unknown>) {
	return attemptLogged(name, job, "deadline", Effect.logError(`Job attempt hit its ${job.expireInSeconds}s deadline`));
}

export function failureLogged(name: string, job: WorkerJob<unknown>, cause: Cause.Cause<unknown>) {
	return attemptLogged(name, job, "failed", Effect.logError("Job attempt failed", redactDiagnosticCause(cause)));
}
