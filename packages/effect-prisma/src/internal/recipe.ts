import { getRelationPlan, type RelationPlan } from "./relation-plan.js";

export interface RelationOperation {
	readonly name: PropertyKey;
	readonly arguments: ReadonlyArray<unknown>;
}

export interface RelationRecipe {
	readonly model: string;
	readonly parent?: RelationRecipe;
	readonly operation?: RelationOperation;
}

export const rootRecipe = (model: string): RelationRecipe => ({ model });

export const appendOperation = (
	parent: RelationRecipe,
	name: PropertyKey,
	arguments_: ReadonlyArray<unknown>,
): RelationRecipe => ({
	model: parent.model,
	parent,
	operation: {
		name,
		arguments: arguments_,
	},
});

const operations = (
	recipe: RelationRecipe,
): ReadonlyArray<RelationOperation> => {
	const reversed: Array<RelationOperation> = [];
	let current: RelationRecipe | undefined = recipe;

	while (current !== undefined) {
		if (current.operation !== undefined) {
			reversed.push(current.operation);
		}
		current = current.parent;
	}

	return reversed.reverse();
};

const applyMethod = (
	current: unknown,
	name: PropertyKey,
	arguments_: ReadonlyArray<unknown>,
	model: string,
): unknown => {
	if (
		typeof current !== "object" ||
		current === null ||
		typeof Reflect.get(current, name) !== "function"
	) {
		throw new TypeError(`Cannot call ${String(name)} while replaying ${model}`);
	}

	const method = Reflect.get(current, name) as (
		...arguments_: ReadonlyArray<unknown>
	) => unknown;
	return Reflect.apply(method, current, arguments_);
};

const replayPlan = (collection: unknown, plan: RelationPlan): unknown => {
	const relatedModel =
		typeof collection === "object" && collection !== null
			? Reflect.get(collection, "modelName")
			: undefined;
	if (typeof relatedModel === "string" && relatedModel !== plan.recipe.model) {
		throw new TypeError(
			`Included relation expects ${relatedModel}, received ${plan.recipe.model}`,
		);
	}

	const refined = replayRecipeFrom(collection, plan.recipe);
	if (plan.terminal !== "count") {
		return refined;
	}
	return applyMethod(refined, "count", [], plan.recipe.model);
};

const includeRefinement = (
	value: unknown,
): ((collection: unknown) => unknown) => {
	const plan = getRelationPlan(value);
	if (plan !== undefined) {
		return (collection) => replayPlan(collection, plan);
	}

	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError(
			"An included relation must be a Relation or query record",
		);
	}

	const entries = Object.entries(value);
	if (entries.length === 0) {
		throw new TypeError("An included query record cannot be empty");
	}

	const plans = entries.map(([name, query]) => {
		const queryPlan = getRelationPlan(query);
		if (queryPlan === undefined) {
			throw new TypeError(`Included query "${name}" is not a Relation`);
		}
		return [name, queryPlan] as const;
	});
	const model = plans[0]?.[1].recipe.model;
	if (plans.some(([, queryPlan]) => queryPlan.recipe.model !== model)) {
		throw new TypeError("Included queries must use the same related model");
	}

	return (collection) => {
		const branches = Object.fromEntries(
			plans.map(([name, queryPlan]) => [
				name,
				replayPlan(collection, queryPlan),
			]),
		);
		return applyMethod(collection, "combine", [branches], model ?? "relation");
	};
};

const replayRecipeFrom = (root: unknown, recipe: RelationRecipe): unknown => {
	let current = root;
	for (const operation of operations(recipe)) {
		const arguments_ =
			operation.name === "include" && operation.arguments.length === 2
				? [operation.arguments[0], includeRefinement(operation.arguments[1])]
				: operation.arguments;
		current = applyMethod(current, operation.name, arguments_, recipe.model);
	}
	return current;
};

export const replayRecipe = (
	models: object,
	recipe: RelationRecipe,
): unknown => {
	const current: unknown = Reflect.get(models, recipe.model);

	if (current === undefined) {
		throw new TypeError(`Unknown Prisma model: ${recipe.model}`);
	}

	return replayRecipeFrom(current, recipe);
};
