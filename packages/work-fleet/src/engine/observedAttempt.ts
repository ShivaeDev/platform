import type { Attempt } from "#model.ts";
import type { SessionObservation } from "#session/schema.ts";

export function observedAttempt(attempt: Attempt, observation: SessionObservation, now: number): Attempt {
	if (attempt.abandoned !== undefined) {
		return attempt;
	}
	const signature = observation.progress === undefined ? undefined : JSON.stringify(observation.progress);
	const observed = signature === undefined || signature === attempt.progress?.signature ? attempt.progress : { at: now, signature };
	const live = observation.activityAt === undefined ? undefined : Math.min(observation.activityAt, now);
	const progress = observed === undefined || live === undefined || live <= observed.at ? observed : { ...observed, at: live };
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
