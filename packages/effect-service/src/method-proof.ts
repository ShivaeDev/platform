import type { Effect, Scope } from "effect";
import type {
	AnyMethod,
	GenericMethodDescriptor,
	GenericOrStructurallyOverloadedMethodsAreUnsupported,
	HasDistinctCallSignatures,
} from "./generic-method.ts";
import type { RequirementRecord, RequirementsOf } from "./service-requirements.ts";

export type MethodEntry = AnyMethod | GenericMethodDescriptor<AnyMethod>;

export type MethodRecord = Readonly<Record<string, AnyMethod>>;

export type MethodInventory = Readonly<Record<string, unknown>>;

export type RuntimeMethodInventory = Readonly<Record<string, MethodEntry>>;

interface GenericMethodWithDeclaredRequirementsIsUnsupported {
	readonly _serviceDefinitionError: "generic methods cannot subtract declared service requirements";
}

type MethodRequirements<TMethod> = TMethod extends (...arguments_: readonly never[]) => Effect.Effect<unknown, unknown, infer TRequirements>
	? TRequirements
	: never;

interface MethodHasUndeclaredServiceRequirements {
	readonly _serviceDefinitionError: "method has service requirements absent from the service declaration";
}

interface ServiceMembersMustBeMethods {
	readonly _serviceDefinitionError: "service members must be methods";
}

type OrdinaryMethodProof<TMethod, TRequirements extends RequirementRecord> = [
	Exclude<MethodRequirements<TMethod>, RequirementsOf<TRequirements> | Scope.Scope>,
] extends [never]
	? TMethod
	: MethodHasUndeclaredServiceRequirements;

type SupportedMethod<TMethod, TRequirements extends RequirementRecord> =
	TMethod extends GenericMethodDescriptor<AnyMethod>
		? TRequirements extends readonly []
			? TMethod
			: GenericMethodWithDeclaredRequirementsIsUnsupported
		: TMethod extends AnyMethod
			? HasDistinctCallSignatures<TMethod> extends true
				? GenericOrStructurallyOverloadedMethodsAreUnsupported
				: TMethod extends (...arguments_: infer TArguments) => infer TResult
					? ((...arguments_: TArguments) => TResult) extends TMethod
						? OrdinaryMethodProof<TMethod, TRequirements>
						: GenericOrStructurallyOverloadedMethodsAreUnsupported
					: GenericOrStructurallyOverloadedMethodsAreUnsupported
			: ServiceMembersMustBeMethods;

export type MethodProof<TMethods extends MethodInventory, TRequirements extends RequirementRecord> = {
	readonly [TName in keyof TMethods]: SupportedMethod<TMethods[TName], TRequirements>;
};
