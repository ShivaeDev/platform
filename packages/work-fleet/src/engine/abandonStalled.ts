import { Effect, Result } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { SessionObservation } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

export const abandonStalled = Effect.fn("Fleet.abandonStalled")(function* (state: EngineState, stored: Versioned<FleetRecord>) {
	const latest = stored.value.attempts.at(-1);
	if (!needsAbandonment(stored.value) || latest?.abandoned !== undefined) {
		return stored;
	}
	const targets = stored.value.attempts.filter((attempt) => attempt === latest || ["submitting", "accepted", "running"].includes(attempt.status));
	const at = state.policy.now();
	let current = yield* state.save(stored, {
		...stored.value,
		attempts: stored.value.attempts.map((attempt) =>
			targets.includes(attempt)
				? {
						...attempt,
						abandoned: attempt.abandoned ?? { at, observation: lastObservation(attempt) },
						output: undefined,
						sessionUnusable: true,
						status: "failed" as const,
					}
				: attempt,
		),
	});
	for (const attempt of targets) {
		const receipt = attempt.receipt;
		if (receipt === undefined) {
			continue;
		}
		const interrupted = yield* state.sessions.interrupt(receipt).pipe(Effect.timeout("5 seconds"), Effect.result);
		const observed = yield* state.sessions.observe(receipt).pipe(Effect.timeout("5 seconds"), Effect.result);
		const abandoned = {
			at: attempt.abandoned?.at ?? at,
			interruptError: Result.isFailure(interrupted) ? interrupted.failure.message : undefined,
			observation: Result.isSuccess(observed) ? withoutActivity(observed.success) : (attempt.abandoned?.observation ?? lastObservation(attempt)),
			observationError: Result.isFailure(observed) ? observed.failure.message : undefined,
		};
		current = yield* state.save(current, {
			...current.value,
			attempts: current.value.attempts.map((saved) => (saved.operationId === attempt.operationId ? { ...saved, abandoned } : saved)),
		});
	}
	return current;
});

function needsAbandonment(record: FleetRecord): boolean {
	const latest = record.attempts.at(-1);
	return (
		record.decision?.code === "session-stalled"
		|| (latest?.sessionUnusable === true && latest.stallRecovery !== undefined)
		|| (latest?.answerTurn === true && latest.missingSince !== undefined)
	);
}

// Live activity is a transient provider signal, so the abandoned evidence keeps only the observed turn.
function withoutActivity({ activityAt: _activityAt, subscribedAt: _subscribedAt, ...observation }: SessionObservation) {
	return observation;
}

function lastObservation(attempt: Attempt): SessionObservation | undefined {
	return attempt.receipt === undefined || attempt.status === "submitting"
		? undefined
		: {
				execution: attempt.status,
				output: attempt.output ?? "",
				provisioning: "unknown",
				receipt: attempt.receipt,
			};
}
