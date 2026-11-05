import { Context, type Effect, Layer } from "effect";

export function defineRepository<const TIdentifier extends string, TShape, TError, TRequirements>(definition: {
	readonly id: TIdentifier;
	readonly initialize: Effect.Effect<TShape, TError, TRequirements>;
}) {
	const repository = Context.Service<TIdentifier, TShape>(definition.id);
	return Object.assign(repository, { layer: Layer.effect(repository)(definition.initialize) });
}
