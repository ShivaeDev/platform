import { Rpc, RpcGroup, type RpcMiddleware } from "effect/unstable/rpc";
import type { CommandShape, OperationShape, QueryShape } from "./operation.ts";

export type Tag<TContract extends string, TName extends string> = `${TContract}.${TName}`;

export type OperationRpc<TContract extends string, TOperation> = TOperation extends OperationShape
	? Rpc.Rpc<Tag<TContract, TOperation["name"]>, TOperation["payload"], TOperation["success"], TOperation["error"]>
	: never;

export interface Declared<TName extends string, TQueries extends readonly QueryShape[], TCommands extends readonly CommandShape[]> {
	readonly commands: TCommands;
	readonly name: TName;
	readonly queries: TQueries;
}

export interface Contract<
	TName extends string,
	TQueries extends readonly QueryShape[],
	TCommands extends readonly CommandShape[],
	TRpcs extends Rpc.Any = OperationRpc<TName, TQueries[number] | TCommands[number]>,
> extends RpcGroup.RpcGroup<TRpcs> {
	readonly declaration: Declared<TName, TQueries, TCommands>;
	middleware: <TM extends RpcMiddleware.AnyService>(middleware: TM) => Contract<TName, TQueries, TCommands, Rpc.AddMiddleware<TRpcs, TM>>;
}

type Duplicated<TOperations extends readonly OperationShape[], TSeen extends string = never> = TOperations extends readonly [
	infer THead extends OperationShape,
	...infer TTail extends readonly OperationShape[],
]
	? (THead["name"] extends TSeen ? THead["name"] : never) | Duplicated<TTail, TSeen | THead["name"]>
	: never;

type Unique<TOperations extends readonly OperationShape[]> = [Duplicated<TOperations>] extends [never]
	? unknown
	: `Operation names must be unique; duplicated: ${Duplicated<TOperations>}`;

function assertUnique(operations: readonly OperationShape[]) {
	const duplicated = operations.map(({ name }) => name).filter((name, index, names) => names.indexOf(name) !== index);
	if (duplicated.length > 0) {
		throw new Error(`Operation names must be unique; duplicated: ${[...new Set(duplicated)].join(", ")}`);
	}
}

type AnyDeclared = Declared<string, readonly QueryShape[], readonly CommandShape[]>;

interface Group {
	middleware: (middleware: RpcMiddleware.AnyService) => Group;
}

interface DeclaredGroup extends Group {
	readonly declaration: AnyDeclared;
}

function withDeclaration(group: Group, declaration: AnyDeclared): DeclaredGroup {
	const nativeMiddleware = group.middleware.bind(group);
	return Object.assign(group, {
		declaration,
		middleware: (middleware: RpcMiddleware.AnyService) => withDeclaration(nativeMiddleware(middleware), declaration),
	});
}

export function contract<
	const TName extends string,
	const TQueries extends readonly QueryShape[] = readonly [],
	const TCommands extends readonly CommandShape[] = readonly [],
>(
	name: TName,
	operations: { readonly queries?: TQueries & Unique<TQueries>; readonly commands?: TCommands & Unique<[...TQueries, ...TCommands]> },
): Contract<TName, TQueries, TCommands>;
export function contract(
	name: string,
	operations: { readonly queries?: readonly QueryShape[]; readonly commands?: readonly CommandShape[] },
): DeclaredGroup {
	const { queries = [], commands = [] } = operations;
	assertUnique([...queries, ...commands]);
	const rpcs = [...queries, ...commands].map((operation) =>
		Rpc.make(`${name}.${operation.name}`, { error: operation.error, payload: operation.payload, success: operation.success }),
	);
	return withDeclaration(RpcGroup.make(...rpcs), { commands, name, queries });
}
