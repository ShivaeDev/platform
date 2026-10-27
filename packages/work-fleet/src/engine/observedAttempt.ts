import type { Attempt } from "#model.ts";
import type { SessionObservation } from "#session/schema.ts";

export function observedAttempt(attempt: Attempt, observation: SessionObservation, now: number, observedAt = now): Attempt {
	if (attempt.abandoned !== undefined) {
		return attempt;
	}
	const signature = observation.progress === undefined ? undefined : JSON.stringify(observation.progress);
	const observed = signature === undefined || signature === attempt.progress?.signature ? attempt.progress : { at: now, signature };
	const since = Math.max(observation.activityAt ?? 0, observation.subscribedAt ?? 0);
	const live = Math.min(since, now);
	const progress = observed === undefined || live <= observed.at ? observed : { ...observed, at: live };
	return {
		...attempt,
		finishedAt: ["completed", "failed", "interrupted"].includes(observation.execution) ? (attempt.finishedAt ?? observedAt) : undefined,
		missingSince: observation.turnMissing ? (attempt.missingSince ?? now) : undefined,
		observationRetries: observation.turnMissing ? attempt.observationRetries : undefined,
		output: observation.output,
		progress,
		readRetry: undefined,
		receipt: observation.receipt,
		status: observation.execution,
	};
}
