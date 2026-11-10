import { Context, type Effect } from "effect";
import type { Rpc, RpcMiddleware } from "effect/rpc";
import type { RequirementRecord } from "@shivaedev/service/ServiceRequirements.ts";
import { type Contract, contract, withDeclaration } from "#contract.ts";
import type { Allowed, NameProof } from "#moduleProof.ts";
import type { CommandShape, QueryShape } from "#operation.ts";
import type { OperationRpc } from "#operationRpc.ts";
import type { ReadPolicyGuard } from "#ReadPolicyGuard.ts";
import type { changesRpc } from "#serverMetadata.ts";
import type { SubjectDeclaration, WithSubject } from "#subject.ts";

export class DefinedModule extends Context.Service<DefinedModule, string>()("@shivaedev/contract/DefinedModule") {}

export type ModuleOperation = (QueryShape | CommandShape) & { readonly run: (payload: never) => Effect.Effect<unknown, unknown, unknown> };

type QueriesOf<TOperations extends readonly ModuleOperation[]> = readonly Extract<TOperations[number], { readonly kind: "query" }>[];
type CommandsOf<TOperations extends readonly ModuleOperation[]> = readonly Extract<TOperations[number], { readonly kind: "command" }>[];

// The module's handlers provide every service its operations use, read policies included, so its RPCs require none.
type Served<TRpc> =
	TRpc extends Rpc.Rpc<infer TTag, infer TPayload, infer TSuccess, infer TError, infer TMiddleware, infer _TRequires>
		? Rpc.Rpc<TTag, TPayload, TSuccess, TError, TMiddleware, never>
		: never;

type WithMiddleware<TRpcs extends Rpc.Any, TMiddleware extends RpcMiddleware.AnyService> = [TMiddleware] extends [never]
	? TRpcs
	: Rpc.AddMiddleware<TRpcs, TMiddleware>;

export type Module<
	TName extends string,
	TOperations extends readonly ModuleOperation[],
	TRequirements extends RequirementRecord,
	TMiddleware extends RpcMiddleware.AnyService = never,
	TSubject extends SubjectDeclaration | undefined = undefined,
	TScope extends "session" | undefined = undefined,
> = Contract<
	TName,
	QueriesOf<TOperations>,
	CommandsOf<TOperations>,
	WithMiddleware<
		WithSubject<
			Served<
				| OperationRpc<TName, TOperations[number]>
				| Rpc.AddMiddleware<ReturnType<typeof changesRpc<TName, QueriesOf<TOperations>>>, typeof ReadPolicyGuard>
			>,
			TSubject
		>,
		TMiddleware
	>,
	readonly [],
	TScope
> & {
	// The compiler checks the list and nothing reads it at run time, so, like Rpc's ~requires, it exists only in the type.
	readonly "~requires": TRequirements;
};

export interface ModuleDefinition<
	TName extends string,
	TOperations extends readonly ModuleOperation[],
	TRequirements extends RequirementRecord,
	TMiddleware extends RpcMiddleware.AnyService,
	TSubject extends SubjectDeclaration | undefined,
	TScope extends "session" | undefined,
> {
	readonly keyScope?: TScope;
	readonly middleware?: TMiddleware;
	readonly name: TName & NoInfer<NameProof<TOperations, Allowed<TRequirements, TMiddleware, TSubject>>>;
	readonly operations: TOperations;
	readonly requires: TRequirements;
	readonly subject?: TSubject;
}

export function defineModule<
	const TName extends string,
	const TOperations extends readonly ModuleOperation[],
	const TRequirements extends RequirementRecord,
	TMiddleware extends RpcMiddleware.AnyService = never,
	const TSubject extends SubjectDeclaration | undefined = undefined,
	const TScope extends "session" | undefined = undefined,
>(
	definition: ModuleDefinition<TName, TOperations, TRequirements, TMiddleware, TSubject, TScope>,
): Module<TName, TOperations, TRequirements, TMiddleware, TSubject, TScope>;
export function defineModule(definition: {
	readonly keyScope?: "session";
	readonly middleware?: RpcMiddleware.AnyService;
	readonly name: string;
	readonly operations: readonly ModuleOperation[];
	readonly subject?: SubjectDeclaration;
}): unknown {
	const declared = contract(definition.name, {
		commands: definition.operations.filter((operation) => operation.kind === "command"),
		queries: definition.operations.filter((operation) => operation.kind === "query"),
		...(definition.keyScope === undefined ? {} : { keyScope: definition.keyScope }),
		...(definition.subject === undefined ? {} : { subject: definition.subject }),
	});
	const group = withDeclaration(
		declared.annotateRpcs(DefinedModule, definition.name),
		declared.application.annotateRpcs(DefinedModule, definition.name),
		declared.declaration,
	);
	return definition.middleware?.key === undefined ? group : group.middleware(definition.middleware);
}
