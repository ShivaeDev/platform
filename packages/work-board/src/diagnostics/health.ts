import { Schema } from "effect";
import { GithubLimits } from "#browser/diagnostics/schema.ts";

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Timestamp = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(8_640_000_000_000_000));
export const CapacityRejection = Schema.Struct({ at: Timestamp, cause: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500)) });
export type CapacityRejection = typeof CapacityRejection.Type;

export const FLEET_HEALTH_NAME = "health.json";
export const FLEET_HEALTH_FILE = `fleet/${FLEET_HEALTH_NAME}`;
export const FleetHealth = Schema.Struct({
	concurrency: Schema.Int.check(Schema.isGreaterThan(0)),
	github: Schema.optional(GithubLimits),
	lastCapacityRejection: Schema.NullOr(CapacityRejection),
	lastSchedulerPass: Schema.NullOr(Timestamp),
	observedAt: Timestamp,
	queued: Count,
	running: Count,
	staleAfterMs: Schema.Int.check(Schema.isGreaterThan(0)),
	version: Schema.Literal(2),
	waiting: Schema.Struct({ automation: Count, maintainer: Count, orchestrator: Count }),
});
export type FleetHealth = typeof FleetHealth.Type;
