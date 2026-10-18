import { Schema } from "effect";
import type { Job } from "pg-boss";

export const deferredAttempt = Symbol("deferredAttempt");

export const Deferral = Schema.Struct({
	at: Schema.String,
	count: Schema.Number,
	reason: Schema.String,
});

const Output = Schema.Struct({ jobDeferral: Deferral });

export function deferralOf(job: Job<unknown>) {
	const output: unknown = Reflect.get(job, "output");
	return Schema.is(Output)(output) ? output.jobDeferral : undefined;
}
