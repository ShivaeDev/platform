import type { Effect } from "effect";

export type AnyMethod = (...arguments_: readonly never[]) => Effect.Effect<unknown, unknown, unknown>;

export type HasDistinctCallSignatures<TMethod> = TMethod extends {
	(...arguments_: infer TFirstArguments): unknown;
	(...arguments_: infer TLastArguments): unknown;
}
	? [TFirstArguments] extends [TLastArguments]
		? [TLastArguments] extends [TFirstArguments]
			? false
			: true
		: true
	: false;

export interface GenericOrStructurallyOverloadedMethodsAreUnsupported {
	readonly _serviceDefinitionError: "generic and structurally overloaded methods are unsupported";
}

export interface GenericMethodDescriptor<TMethod extends AnyMethod> {
	readonly _tag: "GenericMethod";
	readonly method: TMethod;
}

export function genericMethod<TMethod extends AnyMethod>(method: TMethod): GenericMethodDescriptor<TMethod>;
export function genericMethod(method: AnyMethod): unknown {
	return { _tag: "GenericMethod", method };
}
