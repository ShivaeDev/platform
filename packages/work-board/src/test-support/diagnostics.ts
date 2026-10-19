import { Effect } from "effect";
import type { FleetHealth } from "#diagnostics/health.ts";
import type { GithubLimits, Sources } from "#diagnostics/source.ts";

export const githubObservations: GithubLimits = [
	{
		limit: 5000,
		limitedBy: null,
		limitedUntil: null,
		observedAt: 1_799_999_940_000,
		remaining: 4321,
		reset: 1_800_000_000,
		resource: "core",
		used: 679,
	},
	{
		limit: 5000,
		limitedBy: "rate-limit",
		limitedUntil: 1_800_000_600_000,
		observedAt: 1_799_999_700_000,
		remaining: 0,
		reset: 1_800_000_000,
		resource: "graphql",
		used: 5000,
	},
	{
		limit: 30,
		limitedBy: "reserve",
		limitedUntil: 1_800_000_060_000,
		observedAt: 1_799_999_990_000,
		remaining: 5,
		reset: 1_800_000_060,
		resource: "search",
		used: 25,
	},
];
export const health: FleetHealth = {
	concurrency: 8,
	github: githubObservations,
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
export function syntheticSources(overrides: Partial<Sources> = {}): Sources {
	return {
		codex: Effect.succeed(codexResponse.rateLimits),
		fleet: Effect.succeed(health),
		github: Effect.succeed(githubObservations),
		...overrides,
	};
}

export function diagnosticsSnapshot(observedAt: number) {
	return {
		codex: { observedAt, state: "ready" as const, value: codexResponse.rateLimits },
		fleet: { observedAt, state: "ready" as const, value: { ...health, observedAt } },
		github: { observedAt, state: "ready" as const, value: githubObservations },
	};
}
