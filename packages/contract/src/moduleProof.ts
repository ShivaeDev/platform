import type { Effect, Scope } from "effect";
import type { RpcMiddleware } from "effect/rpc";
import type { InfrastructureFailure } from "@shivaedev/errors/infrastructure.ts";
import type { RequirementRecord, RequirementsOf } from "@shivaedev/service/ServiceRequirements.ts";
import type { Duplicated } from "#declarationError.ts";
import type { OperationShape } from "#operation.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";
import type { RejectedBy, RejectionSpecs } from "#rejection.ts";
import type { Raised, RejectionProblem, SuccessProblem } from "#runProof.ts";
import type { SubjectDeclaration, SubjectProvides } from "#subject.ts";
import type { WireEntry, WireEntryOf } from "#wire.ts";

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

type Regenerate = "the generated file is stale; run pnpm generate";

export interface WireSuccessStale<TOperation extends string, TFix extends Regenerate, TRun, TWire> {
	readonly fix: TFix;
	readonly operation: TOperation;
	readonly runReturns: TRun;
	readonly wireDeclares: TWire;
}

export interface WireRejectionsStale<TOperation extends string, TFix extends Regenerate, TRaised, TWire> {
	readonly fix: TFix;
	readonly operation: TOperation;
	readonly runRaises: TRaised;
	readonly wireDeclares: TWire;
}

export interface OperationMissingFromWire<TOperation extends string, TFix extends Regenerate> {
	readonly fix: TFix;
	readonly operation: TOperation;
	readonly problem: "the operation declares no success and the module's wire has no entry for it";
}

export interface OperationNameRepeated<TOperation extends string> {
	readonly operation: TOperation;
	readonly problem: "another operation of the module has this name";
}

type Effectful = (...args: never) => Effect.Effect<unknown, unknown, unknown>;

type Parts<TOperation> =
	| (TOperation extends { readonly run: infer TRun extends Effectful } ? ReturnType<TRun> : never)
	| (TOperation extends { readonly kind: "query"; readonly readPolicy: infer TPolicy extends Effectful } ? ReturnType<TPolicy> : never);

type Returns<TOperation> = TOperation extends { readonly run: infer TRun extends Effectful } ? Effect.Success<ReturnType<TRun>> : never;
type Declared<TOperation> = TOperation extends { readonly rejections: infer TSpecs extends RejectionSpecs } ? RejectedBy<TSpecs> : never;
type Tags<E> = E extends { readonly _tag: infer TTag } ? TTag : E;
type Success<TOperation> = TOperation extends { readonly success: infer TSuccess } ? TSuccess : never;
type NameOf<TOperation> = TOperation extends { readonly name: infer TName extends string } ? TName : string;

type Missing<TOperation, TAllowed> = Exclude<Effect.Services<Parts<TOperation>>, TAllowed | Scope.Scope>;
type Undeclared<TOperation> = Exclude<Effect.Error<Parts<TOperation>>, Declared<TOperation> | InfrastructureFailure | QueryReadDenied>;

// An entry stands in for the operation's own success and rejections, so only the entry is compared with run.
type WireProblem<TOperation, TEntry extends WireEntry> = [SuccessProblem<NameOf<TOperation>, TEntry["success"], Returns<TOperation>>] extends [never]
	? [RejectionProblem<NameOf<TOperation>, TEntry["rejections"], Effect.Error<Parts<TOperation>>>] extends [never]
		? never
		: WireRejectionsStale<NameOf<TOperation>, Regenerate, Tags<Raised<Effect.Error<Parts<TOperation>>>>, keyof TEntry["rejections"]>
	: WireSuccessStale<NameOf<TOperation>, Regenerate, Returns<TOperation>, TEntry["success"]["Type"]>;

type OwnProblem<TOperation> = [Undeclared<TOperation>] extends [never]
	? [SuccessProblem<NameOf<TOperation>, Success<TOperation>, Returns<TOperation>>] extends [never]
		? never
		: OperationMissingFromWire<NameOf<TOperation>, Regenerate>
	: OperationFailsOutsideItsRejections<NameOf<TOperation>, Tags<Undeclared<TOperation>>>;

type OperationProblem<TOperation, TWire, TAllowed> = [Missing<TOperation, TAllowed>] extends [never]
	? WireEntryOf<TWire, NameOf<TOperation>> extends infer TEntry extends WireEntry
		? WireProblem<TOperation, TEntry>
		: OwnProblem<TOperation>
	: OperationNeedsUndeclaredServices<NameOf<TOperation>, Missing<TOperation, TAllowed>>;

type SubjectServices<TSubject> = TSubject extends SubjectDeclaration ? SubjectProvides<TSubject> : never;

export type Allowed<TRequirements extends RequirementRecord, TMiddleware extends RpcMiddleware.AnyService, TSubject> =
	| RequirementsOf<TRequirements>
	| RpcMiddleware.Provides<TMiddleware["Identifier"]>
	| SubjectServices<TSubject>;

type Problems<TOperations extends readonly OperationShape[], TWire, TAllowed> =
	| { readonly [TIndex in keyof TOperations]: OperationProblem<TOperations[TIndex], TWire, TAllowed> }[number]
	| (Duplicated<TOperations> extends infer TName extends string ? (TName extends string ? OperationNameRepeated<TName> : never) : never);

// The proof sits on the module's name, so the first line of the compiler's message names the operation and its problem.
export type NameProof<TOperations extends readonly OperationShape[], TWire, TAllowed> = [Problems<TOperations, TWire, TAllowed>] extends [never]
	? unknown
	: Problems<TOperations, TWire, TAllowed>;
