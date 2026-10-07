import { Rpc, RpcGroup, type RpcMiddleware } from "effect/unstable/rpc";
import type { CommandShape, OperationShape, QueryShape } from "./operation.ts";

export type Tag<Contract extends string, Name extends string> = `${Contract}.${Name}`;

export type OperationRpc<Contract extends string, Operation> = Operation extends OperationShape
	? Rpc.Rpc<Tag<Contract, Operation["name"]>, Operation["payload"], Operation["success"], Operation["error"]>
	: never;

export interface Declared<Name extends string, Queries extends readonly QueryShape[], Commands extends readonly CommandShape[]> {
	readonly commands: Commands;
	readonly name: Name;
	readonly queries: Queries;
}

export interface Contract<
	Name extends string,
	Queries extends readonly QueryShape[],
	Commands extends readonly CommandShape[],
	Rpcs extends Rpc.Any = OperationRpc<Name, Queries[number] | Commands[number]>,
> extends RpcGroup.RpcGroup<Rpcs> {
	readonly declaration: Declared<Name, Queries, Commands>;
	middleware: <M extends RpcMiddleware.AnyService>(middleware: M) => Contract<Name, Queries, Commands, Rpc.AddMiddleware<Rpcs, M>>;
}

type Duplicated<Operations extends readonly OperationShape[], Seen extends string = never> = Operations extends readonly [
	infer Head extends OperationShape,
	...infer Tail extends readonly OperationShape[],
]
	? (Head["name"] extends Seen ? Head["name"] : never) | Duplicated<Tail, Seen | Head["name"]>
	: never;

type Unique<Operations extends readonly OperationShape[]> = [Duplicated<Operations>] extends [never]
	? unknown
	: `Operation names must be unique; duplicated: ${Duplicated<Operations>}`;

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
	const Name extends string,
	const Queries extends readonly QueryShape[] = readonly [],
	const Commands extends readonly CommandShape[] = readonly [],
>(
	name: Name,
	operations: { readonly queries?: Queries & Unique<Queries>; readonly commands?: Commands & Unique<[...Queries, ...Commands]> },
): Contract<Name, Queries, Commands>;
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
