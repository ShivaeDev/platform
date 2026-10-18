import { getTRPCErrorFromUnknown, type TRPCError } from "@trpc/server";
import { type Context, Effect } from "effect";
import type { EffectTRPCAdapter } from "#server/adapter.ts";
export type EffectCaller<TCaller> = {
	readonly [TKey in keyof TCaller]: TCaller[TKey] extends (...arguments_: infer TArguments) => Promise<infer TResult>
		? (...arguments_: TArguments) => Effect.Effect<TResult, TRPCError>
		: TCaller[TKey] extends (...arguments_: infer TArguments) => infer TResult
			? (...arguments_: TArguments) => TResult
			: TCaller[TKey] extends Record<string, unknown>
				? EffectCaller<TCaller[TKey]>
				: TCaller[TKey];
};
export type EffectCallerFactory<TOptions, TCaller> = EffectCaller<TCaller> & ((options?: TOptions) => EffectCaller<TCaller>);
type Adapter = Pick<EffectTRPCAdapter<never>, "runWithServices">;
function member(node: unknown, segment: string): unknown {
	return (typeof node === "object" && node !== null) || typeof node === "function" ? Reflect.get(node, segment) : undefined;
}
function invoke(promiseCaller: object, path: readonly string[], argumentsList: readonly unknown[]): Promise<unknown> {
	const leaf = path.reduce<unknown>(member, promiseCaller);
	return typeof leaf === "function"
		? Promise.resolve(Reflect.apply(leaf, undefined, argumentsList))
		: Promise.reject(new TypeError(`${path.join(".")} is not a procedure`));
}
export function makeEffectCaller<TCaller extends object, TServices>(
	adapter: Adapter,
	promiseCaller: TCaller,
	services: Context.Context<TServices>,
): EffectCaller<TCaller>;
export function makeEffectCaller(adapter: Adapter, promiseCaller: object, services: Context.Context<never>): unknown {
	function build(path: readonly string[]): unknown {
		return new Proxy(
			Object.assign(() => undefined, { path }),
			{
				apply(_target, _this, argumentsList) {
					return Effect.tryPromise({
						catch: getTRPCErrorFromUnknown,
						try: () => adapter.runWithServices(services, () => invoke(promiseCaller, path, argumentsList)),
					});
				},
				get(_target, property) {
					if (typeof property !== "string" || property === "then") {
						return undefined;
					}
					return build([...path, property]);
				},
			},
		);
	}
	return build([]);
}
export function makeEffectCallerFactory<TOptions, TCaller extends object, TServices>(
	adapter: Adapter,
	createCaller: (options?: TOptions) => TCaller,
	services: Context.Context<TServices>,
): EffectCallerFactory<TOptions, TCaller>;
export function makeEffectCallerFactory(adapter: Adapter, createCaller: (options?: unknown) => object, services: Context.Context<never>): unknown {
	const defaultCaller = makeEffectCaller(adapter, createCaller(), services);
	function target(options?: unknown) {
		return makeEffectCaller(adapter, createCaller(options), services);
	}
	return new Proxy(target, {
		get(_target, property, receiver) {
			if (property === "then") {
				return undefined;
			}
			if (typeof property !== "string") {
				return Reflect.get(_target, property, receiver);
			}
			return Reflect.get(defaultCaller, property);
		},
	});
}
