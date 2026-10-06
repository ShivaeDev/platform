import { Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import { type BoardWork, type FleetConfiguration, FleetFailure } from "#policy.ts";
export const admit = Effect.fn("Fleet.admit")(function* (work: BoardWork, records: readonly FleetRecord[], policy: FleetConfiguration) {
	if (policy.approved[work.workId] !== work.revision) {
		return yield* Effect.fail(new FleetFailure({ message: "Current Board revision needs maintainer approval", reason: "denied" }));
	}
	const unavailable = work.dependsOn.filter(
		(id) => !records.some((record) => record.workId === id && record.stage === "completed" && record.outcome !== undefined),
	);
	if (unavailable.length > 0) {
		return yield* Effect.fail(new FleetFailure({ message: `Dependencies need accepted outcomes: ${unavailable.join(", ")}`, reason: "denied" }));
	}
	const quota = policy.quota;
	const submitted = records.flatMap((record) => record.attempts).filter((attempt) => attempt.submittedAt >= quota.observedAt).length;
	if (
		!(Number.isFinite(quota.observedAt) && Number.isFinite(quota.expiresAt))
		|| quota.observedAt > policy.now()
		|| quota.expiresAt <= quota.observedAt
		|| quota.available === undefined
		|| !Number.isFinite(quota.available)
		|| !Number.isInteger(quota.available)
		|| quota.available < 0
		|| quota.expiresAt <= policy.now()
		|| quota.available <= submitted
	) {
		return yield* Effect.fail(new FleetFailure({ message: "Fresh available provider quota is required", reason: "denied" }));
	}
});
