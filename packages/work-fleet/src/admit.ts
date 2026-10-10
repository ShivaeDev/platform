import { Effect } from "effect";
import { allAttempts, type FleetRecord } from "#model.ts";
import { type BoardFailure, type BoardWork, type FleetConfiguration, FleetFailure } from "#policy.ts";
import { qualifyDependencies } from "#qualifyDependencies.ts";
export const admit = Effect.fn("Fleet.admit")(function* (
	work: BoardWork,
	records: readonly FleetRecord[],
	policy: FleetConfiguration,
	get: (workId: string) => Effect.Effect<BoardWork, BoardFailure>,
) {
	if (policy.approved[work.workId] !== work.revision) {
		return yield* Effect.fail(new FleetFailure({ message: "Current Board revision needs maintainer approval", reason: "denied" }));
	}
	yield* qualifyDependencies(work.dependsOn, records, get);
	const quota = policy.quota;
	const submitted = records.flatMap(allAttempts).filter((attempt) => attempt.submittedAt >= quota.observedAt).length;
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
