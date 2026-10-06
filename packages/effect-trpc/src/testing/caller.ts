import { getTRPCErrorFromUnknown, type TRPCError } from "@trpc/server";
import { type Context, Effect } from "effect";
import type { EffectTRPCAdapter } from "#adapter.ts";

export type EffectCaller<Caller> = {
	readonly [Key in keyof Caller]: Caller[Key] extends (...arguments_: infer Arguments) => Promise<infer Result>
		? (...arguments_: Arguments) => Effect.Effect<Result, TRPCError>
		: Caller[Key] extends (...arguments_: infer Arguments) => infer Result
			? (...arguments_: Arguments) => Result
			: Caller[Key] extends Record<string, unknown>
				? EffectCaller<Caller[Key]>
				: Caller[Key];
};

export type EffectCallerFactory<Options, Caller> = EffectCaller<Caller> & ((options?: Options) => EffectCaller<Caller>);

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

export function makeEffectCaller<Caller extends object, Services>(
	adapter: Adapter,
	promiseCaller: Caller,
	services: Context.Context<Services>,
): EffectCaller<Caller>;
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

export function makeEffectCallerFactory<Options, Caller extends object, Services>(
	adapter: Adapter,
	createCaller: (options?: Options) => Caller,
	services: Context.Context<Services>,
): EffectCallerFactory<Options, Caller>;
export function makeEffectCallerFactory(adapter: Adapter, createCaller: (options?: unknown) => object, services: Context.Context<never>): unknown {
	const defaultCaller = makeEffectCaller(adapter, createCaller(), services);
	const target = (options?: unknown) => makeEffectCaller(adapter, createCaller(options), services);

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
