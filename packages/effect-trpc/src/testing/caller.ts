import { getTRPCErrorFromUnknown, type TRPCError } from "@trpc/server";
import { type Context, Effect } from "effect";
import type { EffectTRPCAdapter } from "../adapter.js";

export type EffectCaller<Caller> = {
	readonly [Key in keyof Caller]: Caller[Key] extends (
		...arguments_: infer Arguments
	) => Promise<infer Result>
		? (...arguments_: Arguments) => Effect.Effect<Result, TRPCError>
		: Caller[Key] extends (...arguments_: infer Arguments) => infer Result
			? (...arguments_: Arguments) => Result
			: Caller[Key] extends Record<string, unknown>
				? EffectCaller<Caller[Key]>
				: Caller[Key];
};

export type EffectCallerFactory<Options, Caller> = EffectCaller<Caller> &
	((options?: Options) => EffectCaller<Caller>);

export const makeEffectCaller = <Caller extends object, Services>(
	adapter: Pick<EffectTRPCAdapter<never>, "runWithServices">,
	promiseCaller: Caller,
	services: Context.Context<Services>,
): EffectCaller<Caller> => {
	const build = (path: ReadonlyArray<string>): unknown =>
		new Proxy(
			Object.assign(() => undefined, { path }),
			{
				apply(_target, _this, argumentsList) {
					return Effect.tryPromise({
						catch: getTRPCErrorFromUnknown,
						try: () =>
							adapter.runWithServices(services, () => {
								let leaf: unknown = promiseCaller;
								for (const segment of path) {
									leaf = (leaf as Record<string, unknown>)[segment];
								}
								return (leaf as (...args: unknown[]) => Promise<unknown>)(
									...argumentsList,
								);
							}),
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

	return build([]) as EffectCaller<Caller>;
};

export const makeEffectCallerFactory = <
	Options,
	Caller extends object,
	Services,
>(
	adapter: Pick<EffectTRPCAdapter<never>, "runWithServices">,
	createCaller: (options?: Options) => Caller,
	services: Context.Context<Services>,
): EffectCallerFactory<Options, Caller> => {
	const defaultCaller = makeEffectCaller(adapter, createCaller(), services);
	const target = (options?: Options) =>
		makeEffectCaller(adapter, createCaller(options), services);

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
	}) as EffectCallerFactory<Options, Caller>;
};
