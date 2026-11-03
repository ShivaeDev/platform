import { Schema } from "effect";
import { Rpc, RpcGroup, type RpcMiddleware, type RpcSchema } from "effect/rpc";
import { declarationError, type Unique } from "#internal/declarationError.ts";
import type { CommandShape, OperationShape, QueryShape, StreamShape } from "#operation.ts";
import { ReadPolicyGuard } from "#ReadPolicyGuard.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";
import { changesRpc, KeyScope, operationAnnotations } from "#serverMetadata.ts";

export type Tag<TContract extends string, TName extends string> = `${TContract}.${TName}`;

export type QueryServices<TQuery> = TQuery extends QueryShape<unknown, infer R> ? R : never;

type OperationError<TOperation extends OperationShape> = TOperation extends QueryShape
	? Schema.Union<readonly [TOperation["error"], typeof QueryReadDenied]>
	: TOperation["error"];

export type OperationRpc<TContract extends string, TOperation> = TOperation extends OperationShape
	? TOperation extends StreamShape
		? Rpc.Rpc<Tag<TContract, TOperation["name"]>, TOperation["payload"], RpcSchema.Stream<TOperation["success"], TOperation["error"]>, Schema.Never>
		: Rpc.Rpc<
				Tag<TContract, TOperation["name"]>,
				TOperation["payload"],
				TOperation["success"],
				OperationError<TOperation>,
				TOperation extends QueryShape ? typeof ReadPolicyGuard : never,
				QueryServices<TOperation>
			>
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
	TRpcs extends Rpc.Any =
		| OperationRpc<TName, TQueries[number] | TCommands[number]>
		| Rpc.AddMiddleware<ReturnType<typeof changesRpc<TName, TQueries>>, typeof ReadPolicyGuard>,
	TStreams extends readonly StreamShape[] = readonly [],
	TScope extends "session" | undefined = undefined,
> extends RpcGroup.RpcGroup<TRpcs> {
	readonly application: RpcGroup.RpcGroup<Exclude<TRpcs, { readonly _tag: `${TName}.$changes` }>>;
	readonly declaration: Declared<TName, TQueries, TCommands, TStreams, TScope>;
	middleware: <TM extends RpcMiddleware.AnyService>(
		middleware: TM,
	) => Contract<TName, TQueries, TCommands, Rpc.AddMiddleware<TRpcs, TM>, TStreams, TScope>;
}

function assertValid(name: string, operations: readonly (QueryShape | CommandShape | StreamShape)[]) {
	const error = declarationError(name, operations);
	if (error !== undefined) {
		throw new Error(error);
	}
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
	| OperationRpc<TName, TQueries[number] | TCommands[number] | TStreams[number]>
	| Rpc.AddMiddleware<ReturnType<typeof changesRpc<TName, TQueries>>, typeof ReadPolicyGuard>,
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
	assertValid(name, [...queries, ...commands, ...streams]);
	const rpcs = [...queries, ...commands, ...streams].map((operation) => {
		const rpc = Rpc.make(`${name}.${operation.name}`, {
			error: operation.kind === "query" ? Schema.Union([operation.error, QueryReadDenied]) : operation.error,
			payload: operation.payload,
			stream: operation.kind === "stream",
			success: operation.success,
		}).annotateMerge(operationAnnotations(operation, keyScope));
		return operation.kind === "query" ? rpc.middleware(ReadPolicyGuard) : rpc;
	});
	const application = RpcGroup.make(...rpcs);
	const changes = changesRpc(name, queries).middleware(ReadPolicyGuard);
	return withDeclaration(application.add(keyScope === undefined ? changes : changes.annotate(KeyScope, keyScope)), application, {
		commands,
		keyScope,
		name,
		queries,
		streams,
	});
}
