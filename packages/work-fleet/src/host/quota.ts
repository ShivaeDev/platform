import { Effect, Schema } from "effect";
import { codexRateLimits } from "@shivaedev/work-board/diagnostics/codexRateLimits.ts";
import type { FleetHost } from "#host/config.ts";
import { type FleetConfiguration, FleetFailure } from "#policy.ts";

type Quota = FleetConfiguration["quota"];

const OBSERVATION_MS = 60_000;
// Admission counts submissions against this; while ordinary usage is allowed the provider imposes no smaller number.
const ORDINARY_USAGE = Number.MAX_SAFE_INTEGER;

const RateLimits = Schema.Struct({ ordinaryUsageAllowed: Schema.Boolean });

export function unlimitedQuota(now: () => number): Effect.Effect<Quota> {
	return Effect.sync(() => {
		const observedAt = now();
		return { available: ORDINARY_USAGE, expiresAt: observedAt + OBSERVATION_MS, observedAt };
	});
}

export function codexQuota(
	now: () => number,
	read: Effect.Effect<unknown, FleetFailure> = codexRateLimits().pipe(
		Effect.mapError((error) => new FleetFailure({ message: error.message, reason: "integration" })),
	),
): () => Effect.Effect<Quota, FleetFailure> {
	let cached: Quota | undefined;
	return () =>
		Effect.gen(function* () {
			if (cached !== undefined && cached.expiresAt > now()) {
				return cached;
			}
			const limits = yield* Schema.decodeUnknownEffect(RateLimits)(yield* read).pipe(
				Effect.mapError(() => new FleetFailure({ message: "Codex rate limits returned an unknown shape", reason: "integration" })),
			);
			const observedAt = now();
			cached = { available: limits.ordinaryUsageAllowed ? ORDINARY_USAGE : 0, expiresAt: observedAt + OBSERVATION_MS, observedAt };
			return cached;
		});
}

export function hostQuota(host: FleetHost, now: () => number): () => Effect.Effect<Quota, FleetFailure> {
	return host.quota === "unlimited" ? () => unlimitedQuota(now) : codexQuota(now);
}
