import type { Attempt } from "#model.ts";
import type { SessionObservation } from "#session/schema.ts";

export function observedAttempt(attempt: Attempt, observation: SessionObservation, now: number): Attempt {
	const signature = observation.progress === undefined ? undefined : JSON.stringify(observation.progress);
	const progress = signature === undefined || signature === attempt.progress?.signature ? attempt.progress : { at: now, signature };
	return {
		...attempt,
		missingSince: observation.turnMissing ? (attempt.missingSince ?? now) : undefined,
		observationRetries: observation.turnMissing ? attempt.observationRetries : undefined,
		output: observation.output,
		progress,
		readRetry: undefined,
		receipt: observation.receipt,
		status: observation.execution,
	};
}
