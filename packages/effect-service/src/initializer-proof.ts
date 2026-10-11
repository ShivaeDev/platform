import type { Effect, Scope } from "effect";

interface InitializerHasUndeclaredServiceRequirements {
	readonly _serviceDefinitionError: "initializer has service requirements absent from the service declaration";
}

export type InitializerProof<TInitializer, TRequirements> =
	TInitializer extends Effect.Effect<unknown, unknown, infer TResidual>
		? [Exclude<TResidual, TRequirements | Scope.Scope>] extends [never]
			? TInitializer
			: InitializerHasUndeclaredServiceRequirements
		: never;
