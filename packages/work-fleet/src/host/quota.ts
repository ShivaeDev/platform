import { Effect, Schema } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import type { FleetError } from "#errors.ts";
import type { FleetHost } from "#host/config.ts";
import type { FleetConfiguration } from "#policy.ts";

const { codexRateLimits } = diagnosticsApi;

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
	read: Effect.Effect<unknown, FleetError> = codexRateLimits().pipe(Effect.mapError((error) => new ServiceUnavailable({ message: error.message }))),
): () => Effect.Effect<Quota, FleetError> {
	let cached: Quota | undefined;
	return () =>
		Effect.gen(function* () {
			if (cached !== undefined && cached.expiresAt > now()) {
				return cached;
			}
			const limits = yield* Schema.decodeUnknownEffect(RateLimits)(yield* read).pipe(
				Effect.mapError(() => new ServiceUnavailable({ message: "Codex rate limits returned an unknown shape" })),
			);
			const observedAt = now();
			cached = { available: limits.ordinaryUsageAllowed ? ORDINARY_USAGE : 0, expiresAt: observedAt + OBSERVATION_MS, observedAt };
			return cached;
		});
}

export function hostQuota(host: FleetHost, now: () => number): () => Effect.Effect<Quota, FleetError> {
	return host.quota === "unlimited" ? () => unlimitedQuota(now) : codexQuota(now);
}
