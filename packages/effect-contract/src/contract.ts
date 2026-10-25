import { Context, type Schema } from "effect";
import { Rpc, RpcGroup, type RpcMiddleware, type RpcSchema } from "effect/rpc";
import type { CommandShape, OperationShape, QueryShape, StreamShape } from "#operation.ts";
import { CommandInvalidation, changesRpc, KeyScope, QueryReads } from "#serverMetadata.ts";

export type Tag<TContract extends string, TName extends string> = `${TContract}.${TName}`;

export type OperationRpc<TContract extends string, TOperation> = TOperation extends OperationShape
	? TOperation extends StreamShape
		? Rpc.Rpc<Tag<TContract, TOperation["name"]>, TOperation["payload"], RpcSchema.Stream<TOperation["success"], TOperation["error"]>, Schema.Never>
		: Rpc.Rpc<Tag<TContract, TOperation["name"]>, TOperation["payload"], TOperation["success"], TOperation["error"]>
	: never;

export interface Declared<
	TName extends string,
	TQueries extends readonly QueryShape[],
	TCommands extends readonly CommandShape[],
	TStreams extends readonly StreamShape[] = readonly [],
	TScope extends "session" | undefined = undefined,
> {
	readonly commands: TCommands;
	readonly keyScope: TScope;
	readonly name: TName;
	readonly queries: TQueries;
	readonly streams: TStreams;
}

export interface Contract<
	TName extends string,
	TQueries extends readonly QueryShape[],
	TCommands extends readonly CommandShape[],
	TRpcs extends Rpc.Any = OperationRpc<TName, TQueries[number] | TCommands[number]> | ReturnType<typeof changesRpc<TName, TQueries>>,
	TStreams extends readonly StreamShape[] = readonly [],
	TScope extends "session" | undefined = undefined,
> extends RpcGroup.RpcGroup<TRpcs> {
	readonly application: RpcGroup.RpcGroup<Exclude<TRpcs, { readonly _tag: `${TName}.$changes` }>>;
	readonly declaration: Declared<TName, TQueries, TCommands, TStreams, TScope>;
	middleware: <TM extends RpcMiddleware.AnyService>(
		middleware: TM,
	) => Contract<TName, TQueries, TCommands, Rpc.AddMiddleware<TRpcs, TM>, TStreams, TScope>;
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

function annotations(operation: QueryShape | CommandShape | StreamShape, keyScope: "session" | undefined) {
	const scope = keyScope === undefined ? Context.empty() : Context.make(KeyScope, keyScope);
	if (operation.kind === "command") {
		return Context.add(scope, CommandInvalidation, operation.invalidates);
	}
	return operation.kind === "query" ? Context.add(scope, QueryReads, operation.reads) : scope;
}

type AnyDeclared = Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[], "session" | undefined>;

interface Group {
	middleware: (middleware: RpcMiddleware.AnyService) => Group;
}

interface DeclaredGroup extends Group {
	readonly application: unknown;
	readonly declaration: AnyDeclared;
}

function withDeclaration(group: Group, application: Group, declaration: AnyDeclared): DeclaredGroup {
	const nativeMiddleware = group.middleware.bind(group);
	return Object.assign(group, {
		application,
		declaration,
		middleware: (middleware: RpcMiddleware.AnyService) =>
			withDeclaration(nativeMiddleware(middleware), application.middleware(middleware), declaration),
	});
}

export function contract<
	const TName extends string,
	const TQueries extends readonly QueryShape[] = readonly [],
	const TCommands extends readonly CommandShape[] = readonly [],
	const TStreams extends readonly StreamShape[] = readonly [],
	const TScope extends "session" | undefined = undefined,
>(
	name: TName,
	operations: {
		readonly keyScope?: TScope;
		readonly queries?: TQueries & Unique<TQueries>;
		readonly commands?: TCommands & Unique<[...TQueries, ...TCommands]>;
		readonly streams?: TStreams & Unique<[...TQueries, ...TCommands, ...TStreams]>;
	},
): Contract<
	TName,
	TQueries,
	TCommands,
	OperationRpc<TName, TQueries[number] | TCommands[number] | TStreams[number]> | ReturnType<typeof changesRpc<TName, TQueries>>,
	TStreams,
	TScope
>;
export function contract(
	name: string,
	operations: {
		readonly keyScope?: "session";
		readonly queries?: readonly QueryShape[];
		readonly commands?: readonly CommandShape[];
		readonly streams?: readonly StreamShape[];
	},
): DeclaredGroup {
	const { queries = [], commands = [], streams = [], keyScope } = operations;
	assertUnique([...queries, ...commands, ...streams]);
	const rpcs = [...queries, ...commands, ...streams].map((operation) =>
		Rpc.make(`${name}.${operation.name}`, {
			error: operation.error,
			payload: operation.payload,
			stream: operation.kind === "stream",
			success: operation.success,
		}).annotateMerge(annotations(operation, keyScope)),
	);
	const application = RpcGroup.make(...rpcs);
	const changes = changesRpc(name, queries);
	return withDeclaration(application.add(keyScope === undefined ? changes : changes.annotate(KeyScope, keyScope)), application, {
		commands,
		keyScope,
		name,
		queries,
		streams,
	});
}
