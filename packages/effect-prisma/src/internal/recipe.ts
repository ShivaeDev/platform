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

export const replayRecipe = (
	models: object,
	recipe: RelationRecipe,
): unknown => {
	let current: unknown = Reflect.get(models, recipe.model);

	if (current === undefined) {
		throw new TypeError(`Unknown Prisma model: ${recipe.model}`);
	}

	for (const operation of operations(recipe)) {
		if (
			typeof current !== "object" ||
			current === null ||
			typeof Reflect.get(current, operation.name) !== "function"
		) {
			throw new TypeError(
				`Cannot call ${String(operation.name)} while replaying ${recipe.model}`,
			);
		}

		const method = Reflect.get(current, operation.name) as (
			...arguments_: ReadonlyArray<unknown>
		) => unknown;
		current = Reflect.apply(method, current, operation.arguments);
	}

	return current;
};
