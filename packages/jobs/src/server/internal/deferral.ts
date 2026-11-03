import { Schema } from "effect";
import type { PgBossClient } from "#server/client.ts";
import type { WorkerJob } from "#server/job.ts";

export const deferredAttempt = Symbol("deferredAttempt");
export const deferralObservers = new WeakMap<PgBossClient, () => void>();
export const STATELY_DEFERRAL_POLICY = "effect-stately-deferred";

export const Deferral = Schema.Struct({
	at: Schema.String,
	reason: Schema.String,
});

const Output = Schema.Struct({ jobDeferral: Deferral });

export function deferralOf(job: WorkerJob<unknown>) {
	const output: unknown = Reflect.get(job, "output");
	return Schema.is(Output)(output) ? output.jobDeferral : undefined;
}
