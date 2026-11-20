import type { Effect, Schema, Scope } from "effect";
import type { RpcMiddleware } from "effect/rpc";
import type { RequirementRecord, RequirementsOf } from "@shivaedev/service/ServiceRequirements.ts";
import type { Duplicated } from "#declarationError.ts";
import type { OperationShape } from "#operation.ts";
import type { Raised } from "#runProof.ts";
import type { SubjectDeclaration, SubjectProvides } from "#subject.ts";
import type { WireEntry, WireEntryOf } from "#wire.ts";
import type { RejectionsDiffer, SuccessDiffers } from "#wireProof.ts";

export interface OperationNeedsUndeclaredServices<TOperation extends string, TMissing> {
	readonly missingServices: TMissing;
	readonly operation: TOperation;
	readonly problem: "run or readPolicy uses services that the module's requires and middleware do not provide";
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
	readonly problem: "run returns a value or fails with a rejection, and the module's wire has no entry for the operation";
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
type Tags<E> = E extends { readonly _tag: infer TTag } ? TTag : E;
type NameOf<TOperation> = TOperation extends { readonly name: infer TName extends string } ? TName : string;

type Missing<TOperation, TAllowed> = Exclude<Effect.Services<Parts<TOperation>>, TAllowed | Scope.Scope>;

type WireProblem<TOperation, TEntry extends WireEntry> = [SuccessDiffers<TEntry["success"], Returns<TOperation>>] extends [never]
	? [RejectionsDiffer<TEntry["rejections"], Effect.Error<Parts<TOperation>>>] extends [never]
		? never
		: WireRejectionsStale<NameOf<TOperation>, Regenerate, Tags<Raised<Effect.Error<Parts<TOperation>>>>, keyof TEntry["rejections"]>
	: WireSuccessStale<NameOf<TOperation>, Regenerate, Returns<TOperation>, TEntry["success"]["Type"]>;

// Without an entry the operation is served with Void and the automatic rejections, which fit only a run that returns nothing
// and raises nothing else.
type EntryProblem<TOperation> = [SuccessDiffers<Schema.Void, Returns<TOperation>> | Raised<Effect.Error<Parts<TOperation>>>] extends [never]
	? never
	: OperationMissingFromWire<NameOf<TOperation>, Regenerate>;

type OperationProblem<TOperation, TWire, TAllowed> = [Missing<TOperation, TAllowed>] extends [never]
	? WireEntryOf<TWire, NameOf<TOperation>> extends infer TEntry extends WireEntry
		? WireProblem<TOperation, TEntry>
		: EntryProblem<TOperation>
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
// A definition without a wire leaves TWire at its constraint, whose index signature has every name; proving nothing then
// lets the compiler's own error say that wire is missing.
export type NameProof<TOperations extends readonly OperationShape[], TWire, TAllowed> = string extends keyof TWire
	? unknown
	: [Problems<TOperations, TWire, TAllowed>] extends [never]
		? unknown
		: Problems<TOperations, TWire, TAllowed>;
