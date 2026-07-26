import type { RelationRecipe } from "./recipe.js";

export const RelationPlanTypeId = Symbol.for(
	"@shivaedev/effect-prisma/RelationPlan",
);

export interface RelationPlan {
	readonly recipe: RelationRecipe;
	readonly terminal?: PropertyKey;
}

export const getRelationPlan = (value: unknown): RelationPlan | undefined => {
	if (
		typeof value !== "object" ||
		value === null ||
		!Reflect.has(value, RelationPlanTypeId)
	) {
		return undefined;
	}

	return Reflect.get(value, RelationPlanTypeId) as RelationPlan;
};
