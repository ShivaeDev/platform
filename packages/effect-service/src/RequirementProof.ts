import type { Context, Scope } from "effect";
import type { RequirementRecord } from "./ServiceRequirements.ts";

interface ScopeCannotBeDeclaredAsAServiceRequirement {
	readonly _serviceDefinitionError: "Scope.Scope is caller-owned and cannot be declared as a service requirement";
}

type ProveRequirement<TRequirement> = TRequirement extends Context.Service.Any
	? Context.Service.Identifier<TRequirement> extends Scope.Scope
		? ScopeCannotBeDeclaredAsAServiceRequirement
		: TRequirement
	: never;

export type RequirementProof<TRequirements extends RequirementRecord> = {
	readonly [TIndex in keyof TRequirements]: ProveRequirement<TRequirements[TIndex]>;
};
