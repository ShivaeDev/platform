import type { CommandShape, OperationShape, QueryShape, StreamShape } from "#operation.ts";
import { isPermissionReadPolicy } from "#permissionReadPolicy.ts";

type Duplicated<TOperations extends readonly OperationShape[], TSeen extends string = never> = TOperations extends readonly [
	infer THead extends OperationShape,
	...infer TTail extends readonly OperationShape[],
]
	? (THead["name"] extends TSeen ? THead["name"] : never) | Duplicated<TTail, TSeen | THead["name"]>
	: never;

export type Unique<TOperations extends readonly OperationShape[]> = [Duplicated<TOperations>] extends [never]
	? unknown
	: `Operation names must be unique; duplicated: ${Duplicated<TOperations>}`;

export function declarationError(contractName: string, operations: readonly (QueryShape | CommandShape | StreamShape)[]): string | undefined {
	if (operations.some(({ name }) => name === "$changes")) {
		return `Operation name $changes is reserved for the built-in changes stream on contract ${contractName}`;
	}
	const duplicated = operations.map(({ name }) => name).filter((name, index, names) => names.indexOf(name) !== index);
	if (duplicated.length > 0) {
		return `Operation names must be unique; duplicated: ${[...new Set(duplicated)].join(", ")}`;
	}
	const member = operations.find(
		(operation) => operation.kind === "query" && operation.readsCollections !== undefined && !isPermissionReadPolicy(operation.readPolicy),
	);
	return member === undefined
		? undefined
		: `Collection reads require a permission policy on query ${contractName}.${member.name}; use permissionReadPolicy instead of a member policy`;
}
