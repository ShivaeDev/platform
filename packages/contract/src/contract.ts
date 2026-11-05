import { Schema } from "effect";
import { Rpc, RpcGroup, type RpcMiddleware } from "effect/rpc";
import { declarationError, type Unique } from "#declarationError.ts";
import type { CommandShape, QueryShape, StreamShape } from "#operation.ts";
import type { OperationRpc } from "#operationRpc.ts";
import { ReadPolicyGuard } from "#ReadPolicyGuard.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";
import { changesRpc, KeyScope, operationAnnotations } from "#serverMetadata.ts";
import type { SubjectDeclaration, WithSubject } from "#subject.ts";
import { subjectMiddleware } from "#subjectMiddleware.ts";

export type QueryServices<TQuery> = TQuery extends QueryShape<unknown, infer R> ? R : never;

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
	const TSubject extends SubjectDeclaration | undefined = undefined,
>(
	name: TName,
	operations: {
		readonly keyScope?: TScope;
		readonly subject?: TSubject;
		readonly queries?: TQueries & Unique<TQueries>;
		readonly commands?: TCommands & Unique<[...TQueries, ...TCommands]>;
		readonly streams?: TStreams & Unique<[...TQueries, ...TCommands, ...TStreams]>;
	},
): Contract<
	TName,
	TQueries,
	TCommands,
	WithSubject<
		| OperationRpc<TName, TQueries[number] | TCommands[number] | TStreams[number]>
		| Rpc.AddMiddleware<ReturnType<typeof changesRpc<TName, TQueries>>, typeof ReadPolicyGuard>,
		TSubject
	>,
	TStreams,
	TScope
>;
export function contract(
	name: string,
	operations: {
		readonly keyScope?: "session";
		readonly subject?: SubjectDeclaration;
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
		const guarded = operation.kind === "query" ? rpc.middleware(ReadPolicyGuard) : rpc;
		return operations.subject === undefined ? guarded : guarded.middleware(subjectMiddleware(`${name}.${operation.name}`, operations.subject));
	});
	const application = RpcGroup.make(...rpcs);
	const changes = changesRpc(name, queries).middleware(ReadPolicyGuard);
	const subjectChanges = operations.subject === undefined ? changes : changes.middleware(subjectMiddleware(`${name}.$changes`, operations.subject));
	const group = application.add(keyScope === undefined ? subjectChanges : subjectChanges.annotate(KeyScope, keyScope));
	return withDeclaration(group, application, {
		commands,
		keyScope,
		name,
		queries,
		streams,
	});
}
