import type { Context, Effect, Scope } from "effect";

export type RequirementRecord = readonly Context.Service.Any[];

export type RequirementsOf<TRequirements extends RequirementRecord> = Context.Service.Identifier<TRequirements[number]>;

export type ServiceRequirements<
	TRequirements extends RequirementRecord,
	TSuccess,
	TFailure = never,
	TCallerScope extends Scope.Scope = never,
> = Effect.fn.Return<TSuccess, TFailure, RequirementsOf<TRequirements> | TCallerScope>;
