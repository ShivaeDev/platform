import type { FeatureImplementation } from "@shivaedev/agent/backend.ts";
export function supported<A>(feature: FeatureImplementation<A>): A {
	if (feature.support !== "supported") {
		throw new Error(feature.reason);
	}
	return feature.implementation;
}
