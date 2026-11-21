import { Context, Effect, Layer } from "effect";
import type { Model } from "effect/schema";

export interface ModelOwner {
	readonly column: string;
	readonly field: string;
}

export interface RepositoryModel {
	readonly model: Model.Any;
	readonly owner: ModelOwner | undefined;
	readonly table: string;
}

export interface OwnedModel extends RepositoryModel {
	readonly owner: ModelOwner;
}

// A host learns every model its repositories are built on while it builds them, before it serves a request, and reads back the ones a person owns.
export const RepositoryModels = Context.Reference<{
	readonly declare: (model: RepositoryModel) => Effect.Effect<void>;
	readonly owned: Effect.Effect<readonly OwnedModel[]>;
}>("@shivaedev/sql/RepositoryModels", { defaultValue: () => ({ declare: () => Effect.void, owned: Effect.succeed([]) }) });

// Keyed by model, so building one repository twice keeps one entry while two models over one table keep both.
export const collectRepositoryModels = Layer.sync(RepositoryModels, () => {
	const owned = new Map<Model.Any, OwnedModel>();
	return RepositoryModels.of({
		declare: ({ model, owner, table }) =>
			Effect.sync(() => {
				if (owner !== undefined) {
					owned.set(model, { model, owner, table });
				}
			}),
		owned: Effect.sync(() => [...owned.values()]),
	});
});
