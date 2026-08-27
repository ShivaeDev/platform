import type { RelationRecipe } from "./recipe.js";

export interface RelationPlan {
	readonly liveness: { readonly open: boolean };
	readonly owner: object;
	readonly recipe: RelationRecipe;
	readonly terminal?: PropertyKey;
}

const plans = new WeakMap<object, RelationPlan>();

export const setRelationPlan = (value: object, plan: RelationPlan): void => {
	plans.set(value, plan);
};

export const getRelationPlan = (value: unknown): RelationPlan | undefined => {
	if (typeof value !== "object" || value === null) {
		return undefined;
	}
	return plans.get(value);
};
