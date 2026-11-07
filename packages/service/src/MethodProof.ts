import type { Effect, Scope } from "effect";
import type {
	AnyMethod,
	GenericMethodDescriptor,
	GenericOrStructurallyOverloadedMethodsAreUnsupported,
	HasDistinctCallSignatures,
} from "#genericMethod.ts";
import type { RequirementRecord, RequirementsOf } from "#ServiceRequirements.ts";

export type MethodEntry = AnyMethod | GenericMethodDescriptor<AnyMethod>;

export type MethodRecord = Readonly<Record<string, AnyMethod>>;

export type MethodInventory = Readonly<Record<string, unknown>>;

export type RuntimeMethodInventory = Readonly<Record<string, MethodEntry>>;

type MethodRequirements<TMethod> = TMethod extends (...arguments_: readonly never[]) => Effect.Effect<unknown, unknown, infer TRequirements>
	? TRequirements
	: never;

interface MethodHasUndeclaredServiceRequirements<TName extends PropertyKey, TMissing> {
	readonly _serviceDefinitionError: "method has service requirements absent from the service declaration";
	readonly method: TName;
	readonly missingServices: TMissing;
}

interface ServiceMembersMustBeMethods {
	readonly _serviceDefinitionError: "service members must be methods";
}

type OrdinaryMethodProof<TName extends PropertyKey, TMethod, TRequirements extends RequirementRecord> = [
	Exclude<MethodRequirements<TMethod>, RequirementsOf<TRequirements> | Scope.Scope>,
] extends [never]
	? TMethod
	: MethodHasUndeclaredServiceRequirements<TName, Exclude<MethodRequirements<TMethod>, RequirementsOf<TRequirements> | Scope.Scope>>;

type SupportedMethod<TName extends PropertyKey, TMethod, TRequirements extends RequirementRecord> =
	TMethod extends GenericMethodDescriptor<AnyMethod>
		? TMethod extends GenericMethodDescriptor<infer TGenericMethod>
			? [HasDistinctCallSignatures<TGenericMethod>] extends [true]
				? GenericOrStructurallyOverloadedMethodsAreUnsupported
				: TMethod
			: TMethod
		: TMethod extends AnyMethod
			? HasDistinctCallSignatures<TMethod> extends true
				? GenericOrStructurallyOverloadedMethodsAreUnsupported
				: TMethod extends (...arguments_: infer TArguments) => infer TResult
					? ((...arguments_: TArguments) => TResult) extends TMethod
						? OrdinaryMethodProof<TName, TMethod, TRequirements>
						: GenericOrStructurallyOverloadedMethodsAreUnsupported
					: GenericOrStructurallyOverloadedMethodsAreUnsupported
			: ServiceMembersMustBeMethods;

export type MethodProof<TMethods extends MethodInventory, TRequirements extends RequirementRecord> = {
	readonly [TName in keyof TMethods]: SupportedMethod<TName, TMethods[TName], TRequirements>;
};
