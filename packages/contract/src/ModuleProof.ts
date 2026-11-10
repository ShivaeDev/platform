import type { Effect, Scope } from "effect";
import type { RpcMiddleware } from "effect/rpc";
import type { InfrastructureFailure } from "@shivaedev/errors/infrastructure.ts";
import type { RequirementRecord, RequirementsOf } from "@shivaedev/service/ServiceRequirements.ts";
import type { Duplicated } from "#declarationError.ts";
import type { OperationShape } from "#operation.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";
import type { RejectedBy, RejectionSpecs } from "#rejection.ts";
import type { SubjectDeclaration, SubjectProvides } from "#subject.ts";

export interface OperationNeedsUndeclaredServices<TOperation extends string, TMissing> {
	readonly missingServices: TMissing;
	readonly operation: TOperation;
	readonly problem: "run or readPolicy uses services that the module's requires and middleware do not provide";
}

export interface OperationFailsOutsideItsRejections<TOperation extends string, TUndeclared> {
	readonly operation: TOperation;
	readonly problem: "run or readPolicy fails with errors outside the operation's rejections";
	readonly undeclaredFailures: TUndeclared;
}

export interface OperationNameRepeated<TOperation extends string> {
	readonly operation: TOperation;
	readonly problem: "another operation of the module has this name";
}

type Effectful = (...args: never) => Effect.Effect<unknown, unknown, unknown>;

type Parts<TOperation> =
	| (TOperation extends { readonly run: infer TRun extends Effectful } ? ReturnType<TRun> : never)
	| (TOperation extends { readonly kind: "query"; readonly readPolicy: infer TPolicy extends Effectful } ? ReturnType<TPolicy> : never);

type Declared<TOperation> = TOperation extends { readonly rejections: infer TSpecs extends RejectionSpecs } ? RejectedBy<TSpecs> : never;
type Tags<E> = E extends { readonly _tag: infer TTag } ? TTag : E;
type NameOf<TOperation> = TOperation extends { readonly name: infer TName extends string } ? TName : string;

type Missing<TOperation, TAllowed> = Exclude<Effect.Services<Parts<TOperation>>, TAllowed | Scope.Scope>;
type Undeclared<TOperation> = Exclude<Effect.Error<Parts<TOperation>>, Declared<TOperation> | InfrastructureFailure | QueryReadDenied>;

type OperationProblem<TOperation, TAllowed> = [Missing<TOperation, TAllowed>] extends [never]
	? [Undeclared<TOperation>] extends [never]
		? never
		: OperationFailsOutsideItsRejections<NameOf<TOperation>, Tags<Undeclared<TOperation>>>
	: OperationNeedsUndeclaredServices<NameOf<TOperation>, Missing<TOperation, TAllowed>>;

type SubjectServices<TSubject> = TSubject extends SubjectDeclaration ? SubjectProvides<TSubject> : never;

export type Allowed<TRequirements extends RequirementRecord, TMiddleware extends RpcMiddleware.AnyService, TSubject> =
	| RequirementsOf<TRequirements>
	| RpcMiddleware.Provides<TMiddleware["Identifier"]>
	| SubjectServices<TSubject>;

type Problems<TOperations extends readonly OperationShape[], TAllowed> =
	| { readonly [TIndex in keyof TOperations]: OperationProblem<TOperations[TIndex], TAllowed> }[number]
	| (Duplicated<TOperations> extends infer TName extends string ? (TName extends string ? OperationNameRepeated<TName> : never) : never);

// The proof sits on the module's name, so the first line of the compiler's message names the operation and its problem.
export type NameProof<TOperations extends readonly OperationShape[], TAllowed> = [Problems<TOperations, TAllowed>] extends [never]
	? unknown
	: Problems<TOperations, TAllowed>;
