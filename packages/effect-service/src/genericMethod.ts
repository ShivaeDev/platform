import type { Effect } from "effect";

export type AnyMethod = (...arguments_: readonly never[]) => Effect.Effect<unknown, unknown, unknown>;

export interface GenericMethodDescriptor<TMethod extends AnyMethod> {
	readonly _tag: "GenericMethod";
	readonly method: TMethod;
}

type Same<TLeft, TRight> = (<TValue>() => TValue extends TLeft ? 1 : 2) extends <TValue>() => TValue extends TRight ? 1 : 2 ? true : false;

export type HasDistinctCallSignatures<TMethod> = TMethod extends {
	(...arguments_: infer TFirstArguments): infer TFirstResult;
	(...arguments_: infer TLastArguments): infer TLastResult;
}
	? Same<TFirstArguments, TLastArguments> extends true
		? Same<TFirstResult, TLastResult> extends true
			? false
			: true
		: true
	: false;

export interface GenericOrStructurallyOverloadedMethodsAreUnsupported {
	readonly _serviceDefinitionError: "generic and structurally overloaded methods are unsupported";
}

type MarkedMethod<TMethod extends AnyMethod> =
	HasDistinctCallSignatures<TMethod> extends true ? GenericOrStructurallyOverloadedMethodsAreUnsupported : GenericMethodDescriptor<TMethod>;

export function genericMethod<TMethod extends AnyMethod>(method: TMethod): MarkedMethod<TMethod>;
export function genericMethod(method: AnyMethod): unknown {
	return { _tag: "GenericMethod", method };
}
