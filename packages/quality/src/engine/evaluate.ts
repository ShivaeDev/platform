import { applyBaseline, type Regression, type StaleBaselineEntry } from "../baseline/compare.ts";
import type { BaselineEntry } from "../baseline/format.ts";
import type { Level } from "../config.ts";
import { applyRegistry, type RegistryEntry, type StaleRegistryEntry } from "../exceptions/registry.ts";
import { byLocation, type Violation } from "./violation.ts";

export interface Outcome {
	readonly errors: ReadonlyArray<Violation>;
	readonly warnings: ReadonlyArray<Violation>;
	readonly regressions: ReadonlyArray<Regression>;
	readonly staleBaseline: ReadonlyArray<StaleBaselineEntry>;
	readonly staleRegistry: ReadonlyArray<StaleRegistryEntry>;
	readonly baselined: number;
	readonly registered: number;
}

export const evaluate = (
	violations: ReadonlyArray<Violation>,
	registry: ReadonlyArray<RegistryEntry>,
	baseline: ReadonlyArray<BaselineEntry>,
	levels: ReadonlyMap<string, Level>,
): Outcome => {
	const registered = applyRegistry(violations, registry, levels);
	const baselined = applyBaseline(registered.kept, baseline, levels);
	const kept = [...baselined.kept].sort(byLocation);
	return {
		baselined: baselined.baselined,
		errors: kept.filter((violation) => violation.level === "error"),
		regressions: baselined.regressions,
		registered: registered.registered,
		staleBaseline: baselined.stale,
		staleRegistry: registered.stale,
		warnings: kept.filter((violation) => violation.level === "warn"),
	};
};

export const passes = (outcome: Outcome): boolean =>
	outcome.errors.length === 0 && outcome.staleBaseline.length === 0 && outcome.staleRegistry.length === 0;
