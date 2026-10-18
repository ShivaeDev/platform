import { camelToSnake, snakeToCamel } from "effect/String";

export interface SqlNameTransforms {
	readonly transformQueryNames?: ((name: string) => string) | undefined;
	readonly transformResultNames?: ((name: string) => string) | undefined;
}

export function clientOptions<TOptions extends object>(
	options: TOptions,
	{ snakeCase = true }: { readonly snakeCase?: boolean } = {},
): TOptions & SqlNameTransforms {
	return {
		...(snakeCase ? { transformQueryNames: camelToSnake, transformResultNames: snakeToCamel } : {}),
		...options,
	};
}
