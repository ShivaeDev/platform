import { Context, Effect, Layer, Record } from "effect";
import type { MethodEntry, MethodRecord, RuntimeMethodInventory } from "#MethodProof.ts";
import type { RequirementRecord } from "#ServiceRequirements.ts";

interface RuntimeDefinition<TState> {
	readonly id: string;
	readonly initialize: Effect.Effect<TState, unknown, unknown>;
	readonly methods: (state: TState) => RuntimeMethodInventory;
	readonly requires: RequirementRecord;
}

export function requirementLayer<TState>(service: Context.Service<string, MethodRecord>, definition: RuntimeDefinition<TState>) {
	return Layer.effect(service)(
		Effect.gen(function* () {
			const ambient = yield* Effect.context<string>();
			const declared = Context.pick(...definition.requires)(ambient);
			const state = yield* Effect.provide(definition.initialize, declared);
			return Record.map(definition.methods(state), (entry: MethodEntry) => {
				const method = typeof entry === "function" ? entry : entry.method;
				return (...arguments_: readonly never[]) => Effect.provide(method(...arguments_), declared);
			});
		}),
	);
}
