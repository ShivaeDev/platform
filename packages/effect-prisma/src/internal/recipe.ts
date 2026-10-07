import { hasMethod, invokeMethod } from "./dynamic.ts";
import { getRelationPlan, type RelationPlan } from "./relation-plan.ts";

export interface RelationOperation {
	readonly arguments: readonly unknown[];
	readonly name: PropertyKey;
}

export interface RelationRecipe {
	readonly model: string;
	readonly operation?: RelationOperation;
	readonly parent?: RelationRecipe;
}

export const rootRecipe = (model: string): RelationRecipe => ({ model });

export const appendOperation = (parent: RelationRecipe, name: PropertyKey, arguments_: readonly unknown[]): RelationRecipe => ({
	model: parent.model,
	operation: {
		arguments: arguments_,
		name,
	},
	parent,
});

function operations(recipe: RelationRecipe): readonly RelationOperation[] {
	const reversed: RelationOperation[] = [];
	let current: RelationRecipe | undefined = recipe;

	while (current !== undefined) {
		if (current.operation !== undefined) {
			reversed.push(current.operation);
		}
		current = current.parent;
	}

	return reversed.reverse();
}

function applyMethod(current: unknown, name: PropertyKey, arguments_: readonly unknown[], model: string): unknown {
	if (!hasMethod(current, name)) {
		throw new TypeError(`Cannot call ${String(name)} while replaying ${model}`);
	}
	return invokeMethod(current, name, arguments_);
}

function replayPlan(collection: unknown, plan: RelationPlan, owner: object, transactionIdentity: object | undefined): unknown {
	if (!plan.liveness.open) {
		throw new TypeError("Included Relation is closed");
	}
	if (plan.owner !== owner) {
		throw new TypeError("Included Relations must use the same Database");
	}
	if (plan.transactionIdentity !== undefined && plan.transactionIdentity !== transactionIdentity) {
		throw new TypeError("Included Relation belongs to another transaction");
	}
	const relatedModel = typeof collection === "object" && collection !== null ? Reflect.get(collection, "modelName") : undefined;
	if (typeof relatedModel === "string" && relatedModel !== plan.recipe.model) {
		throw new TypeError(`Included relation expects ${relatedModel}, received ${plan.recipe.model}`);
	}

	const refined = replayRecipeFrom(collection, plan.recipe, owner, transactionIdentity);
	if (plan.terminal !== "count") {
		return refined;
	}
	return applyMethod(refined, "count", [], plan.recipe.model);
}

function includeRefinement(value: unknown, owner: object, transactionIdentity: object | undefined): (collection: unknown) => unknown {
	const plan = getRelationPlan(value);
	if (plan !== undefined) {
		return (collection) => replayPlan(collection, plan, owner, transactionIdentity);
	}

	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError("An included relation must be a Relation or query record");
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
		const branches = Object.fromEntries(plans.map(([name, queryPlan]) => [name, replayPlan(collection, queryPlan, owner, transactionIdentity)]));
		return applyMethod(collection, "combine", [branches], model ?? "relation");
	};
}

function replayRecipeFrom(root: unknown, recipe: RelationRecipe, owner: object, transactionIdentity: object | undefined): unknown {
	let current = root;
	for (const operation of operations(recipe)) {
		const arguments_ =
			operation.name === "include" && operation.arguments.length === 2
				? [operation.arguments[0], includeRefinement(operation.arguments[1], owner, transactionIdentity)]
				: operation.arguments;
		current = applyMethod(current, operation.name, arguments_, recipe.model);
	}
	return current;
}

export const replayRecipe = (models: object, recipe: RelationRecipe, owner: object, transactionIdentity: object | undefined): unknown => {
	const current: unknown = Reflect.get(models, recipe.model);

	if (current === undefined) {
		throw new TypeError(`Unknown Prisma model: ${recipe.model}`);
	}

	return replayRecipeFrom(current, recipe, owner, transactionIdentity);
};
