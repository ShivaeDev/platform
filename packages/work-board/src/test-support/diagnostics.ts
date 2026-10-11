import { Effect } from "effect";
import type { FleetHealth } from "#diagnostics/health.ts";
import type { Sources } from "#diagnostics/source.ts";

export const health: FleetHealth = {
	concurrency: 8,
	lastCapacityRejection: { at: 1_799_999_990_000, cause: "Provider is at capacity" },
	lastSchedulerPass: 1_800_000_000_000,
	observedAt: 1_800_000_000_000,
	queued: 5,
	running: 3,
	staleAfterMs: 60_000,
	version: 2,
	waiting: { automation: 1, maintainer: 2, orchestrator: 3 },
};
export const codexResponse = {
	ordinaryUsageAllowed: true,
	rateLimits: {
		primary: { resetsAt: 1_800_000_000, usedPercent: 24, windowDurationMins: 300 },
		secondary: { resetsAt: 1_800_086_400, usedPercent: 63, windowDurationMins: 10_080 },
	},
};
export const githubResponse = {
	resources: {
		core: { limit: 5000, remaining: 4321, reset: 1_800_000_000 },
		graphql: { limit: 5000, remaining: 3210, reset: 1_800_000_000 },
	},
};
export function syntheticSources(overrides: Partial<Sources> = {}): Sources {
	return {
		codex: Effect.succeed(codexResponse.rateLimits),
		fleet: Effect.succeed(health),
		github: Effect.succeed(githubResponse.resources),
		...overrides,
	};
}
