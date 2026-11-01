import type { CommandShape, QueryShape, StreamShape } from "#operation.ts";
import { isPermissionReadPolicy } from "#permissionReadPolicy.ts";

export function declarationError(contractName: string, operations: readonly (QueryShape | CommandShape | StreamShape)[]): string | undefined {
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
