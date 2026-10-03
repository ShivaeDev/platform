import { applyBaseline, type Regression, type StaleBaselineEntry } from "../baseline/compare.ts";
import type { BaselineEntry } from "../baseline/format.ts";
import { applyRegistry, type RegistryEntry, type StaleRegistryEntry } from "../exceptions/registry.ts";
import { byLocation, type RuleIndex, type Violation } from "./violation.ts";

export interface Outcome {
	readonly baselined: number;
	readonly errors: readonly Violation[];
	readonly looseBaseline: readonly StaleBaselineEntry[];
	readonly registered: number;
	readonly regressions: readonly Regression[];
	readonly staleBaseline: readonly StaleBaselineEntry[];
	readonly staleRegistry: readonly StaleRegistryEntry[];
	readonly warnings: readonly Violation[];
}

export const evaluate = (
	violations: readonly Violation[],
	registry: readonly RegistryEntry[],
	baseline: readonly BaselineEntry[],
	rules: RuleIndex,
): Outcome => {
	const registered = applyRegistry(violations, registry, rules);
	const baselined = applyBaseline(registered.kept, baseline, rules);
	const kept = [...baselined.kept].sort(byLocation);
	return {
		baselined: baselined.baselined,
		errors: kept.filter((violation) => violation.level === "error"),
		looseBaseline: baselined.loose,
		registered: registered.registered,
		regressions: baselined.regressions,
		staleBaseline: baselined.stale,
		staleRegistry: registered.stale,
		warnings: kept.filter((violation) => violation.level === "warn"),
	};
};

export const passes = (outcome: Outcome): boolean =>
	outcome.errors.length === 0 && outcome.staleBaseline.length === 0 && outcome.staleRegistry.length === 0;
