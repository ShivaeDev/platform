import { Context, Effect, Layer, Record } from "effect";
import type { AnyMethod, GenericMethodDescriptor } from "./genericMethod.ts";
import type { InitializerProof } from "./InitializerProof.ts";
import type { MethodEntry, MethodInventory, MethodProof, MethodRecord, RuntimeMethodInventory } from "./MethodProof.ts";
import type { RequirementProof } from "./RequirementProof.ts";
import type { RequirementRecord, RequirementsOf } from "./ServiceRequirements.ts";

type BoundMethod<TMethod, TRequirements> = TMethod extends (
	...arguments_: infer TArguments
) => Effect.Effect<infer TSuccess, infer TFailure, infer TResidual>
	? (...arguments_: TArguments) => Effect.Effect<TSuccess, TFailure, Exclude<TResidual, TRequirements>>
	: never;

type PublicMethod<TEntry, TRequirements> = TEntry extends GenericMethodDescriptor<infer TMethod> ? TMethod : BoundMethod<TEntry, TRequirements>;

type ServiceShape<TMethods extends MethodInventory, TRequirements extends RequirementRecord> = Readonly<{
	[TName in keyof TMethods]: PublicMethod<TMethods[TName], RequirementsOf<TRequirements>>;
}>;

interface ServiceDefinition<
	TIdentifier extends string,
	TRequirements extends RequirementRecord,
	TInitializer extends Effect.Effect<unknown, unknown, unknown>,
	TMethods extends MethodInventory,
> {
	readonly id: TIdentifier;
	readonly initialize: TInitializer & InitializerProof<TInitializer, RequirementsOf<TRequirements>>;
	readonly methods: (state: Effect.Success<TInitializer>) => TMethods & MethodProof<NoInfer<TMethods>, TRequirements>;
	readonly requires: TRequirements & RequirementProof<TRequirements>;
}

interface RuntimeDefinition<TState> {
	readonly id: string;
	readonly initialize: Effect.Effect<TState, unknown, unknown>;
	readonly methods: (state: TState) => RuntimeMethodInventory;
	readonly requires: RequirementRecord;
}

type DefinedService<TIdentifier extends string, TShape, TFailure, TRequirements> = Context.Service<TIdentifier, TShape> & {
	readonly layer: Layer.Layer<TIdentifier, TFailure, TRequirements>;
};

export function defineService<
	const TIdentifier extends string,
	const TRequirements extends RequirementRecord,
	const TInitializer extends Effect.Effect<unknown, unknown, unknown>,
	const TMethods extends MethodInventory,
>(
	definition: ServiceDefinition<TIdentifier, TRequirements, TInitializer, TMethods>,
): DefinedService<TIdentifier, ServiceShape<TMethods, TRequirements>, Effect.Error<TInitializer>, RequirementsOf<TRequirements>>;
export function defineService<TState>(definition: RuntimeDefinition<TState>): unknown {
	const service = Context.Service<string, MethodRecord>(definition.id);
	const layer = Layer.effect(service)(
		Effect.gen(function* () {
			const ambient = yield* Effect.context<string>();
			const declared = Context.pick(...definition.requires)(ambient);
			const state = yield* Effect.provide(definition.initialize, declared);
			return Record.map(definition.methods(state), (entry: MethodEntry) => {
				const method: AnyMethod = typeof entry === "function" ? entry : entry.method;
				return (...arguments_: readonly never[]) => Effect.provide(method(...arguments_), declared);
			});
		}),
	);
	return Object.assign(service, { layer });
}
