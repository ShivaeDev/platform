import { Effect, Record } from "effect";
import { type Agent, Backend, type FeatureImplementation, type FeatureImplementations } from "#backend.ts";
import { UnsupportedCapability } from "#failures.ts";
import type { BackendDescriptor, Feature, FeatureDescriptor } from "#features.ts";

export const describe = Effect.gen(function* () {
	const backend = yield* Backend;
	const features = Record.map(
		backend.features,
		(feature: FeatureImplementation<unknown>): FeatureDescriptor =>
			feature.support === "supported" ? { support: "supported" } : { reason: feature.reason, support: "unsupported" },
	);
	return { backend: backend.backend, features } satisfies BackendDescriptor;
});

const negotiate = Effect.fn("Agent.negotiate")(function* (requirements: readonly Feature[]) {
	const backend = yield* Backend;
	const descriptor = yield* describe;
	for (const requirement of requirements) {
		if (backend.features[requirement].support === "unsupported") {
			return yield* Effect.fail(new UnsupportedCapability({ available: descriptor, backend: backend.backend, requirement }));
		}
	}
	const selected = Object.fromEntries<FeatureImplementations[Feature]>(
		requirements.flatMap((key) => {
			const feature = backend.features[key];
			return feature.support === "supported" ? [[key, feature.implementation]] : [];
		}),
	);
	return { descriptor, events: backend.events, inspect: backend.inspect, reconcile: backend.reconcile, start: backend.start, ...selected };
});

export function requireFeatures<const TFeature extends Feature>(
	requirements: readonly TFeature[],
): Effect.Effect<Agent<TFeature>, UnsupportedCapability, Backend>;
export function requireFeatures(requirements: readonly Feature[]): Effect.Effect<unknown, UnsupportedCapability, Backend> {
	return negotiate(requirements);
}
