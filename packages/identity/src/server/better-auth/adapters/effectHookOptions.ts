import type { BetterAuthOptions, GenericEndpointContext } from "better-auth";
import type { Effect } from "effect";
import type { BetterAuthDatabaseHooks, BetterAuthHookError } from "#server/better-auth/databaseHooks.ts";
import type { hookRuntime } from "./hookRuntime.ts";

type SessionCreate = NonNullable<NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["session"]>["create"]>;
type HookResult = Awaited<ReturnType<NonNullable<SessionCreate["before"]>>>;
type NativeHook<TData, TResult> = (data: TData, endpoint: GenericEndpointContext | null) => Promise<TResult>;
type EffectHook<TData, TResult, R> = (data: TData, endpoint: GenericEndpointContext | null) => Effect.Effect<TResult, BetterAuthHookError, R>;
interface Operation<TBefore, TAfter, TResult> {
	after?: NativeHook<TAfter, void>;
	before?: NativeHook<TBefore, TResult>;
}
interface EffectOperation<TBefore, TAfter, TResult, R> {
	readonly after?: EffectHook<TAfter, void, R>;
	readonly before?: EffectHook<TBefore, TResult, R>;
}

function mergeResult<T extends HookResult>(previous: T | undefined, next: T): T | undefined {
	if (typeof previous === "object" && typeof next === "object") {
		return { ...next, data: { ...previous.data, ...next.data } };
	}
	return next === undefined || next === true ? (previous ?? next) : next;
}

export function effectHookOptions<TOptions extends BetterAuthOptions, R>(
	options: TOptions,
	hooks: BetterAuthDatabaseHooks<R> | undefined,
	runtime: Effect.Success<ReturnType<typeof hookRuntime<R>>>,
): TOptions {
	function composeBefore<TData extends object, TResult extends HookResult>(hook: EffectHook<TData, TResult, R>, own?: NativeHook<TData, TResult>) {
		return async (data: TData, endpoint: GenericEndpointContext | null) => {
			const previous = await own?.(data, endpoint);
			if (previous === false) {
				return previous;
			}
			const input = typeof previous === "object" ? { ...data, ...previous.data } : data;
			const next = await runtime.runHook(() => hook(input, endpoint), endpoint?.request?.signal);
			return mergeResult(previous, next);
		};
	}
	function composeAfter<TData>(hook: EffectHook<TData, void, R>, own?: NativeHook<TData, void>) {
		return async (data: TData, endpoint: GenericEndpointContext | null) => {
			await own?.(data, endpoint);
			await runtime.runHook(() => hook(data, endpoint), endpoint?.request?.signal);
		};
	}
	function operation<TBefore extends object, TAfter, TResult extends HookResult>(
		own: Operation<TBefore, TAfter, TResult> | undefined,
		application: EffectOperation<TBefore, TAfter, TResult, R> | undefined,
	) {
		return {
			...own,
			...(application?.before === undefined ? {} : { before: composeBefore(application.before, own?.before) }),
			...(application?.after === undefined ? {} : { after: composeAfter(application.after, own?.after) }),
		};
	}
	if (hooks === undefined) {
		return options;
	}
	const native = options.databaseHooks;
	return {
		...options,
		databaseHooks: {
			account: {
				create: operation(native?.account?.create, hooks.account?.create),
				delete: operation(native?.account?.delete, hooks.account?.delete),
				update: operation(native?.account?.update, hooks.account?.update),
			},
			session: {
				create: operation(native?.session?.create, hooks.session?.create),
				delete: operation(native?.session?.delete, hooks.session?.delete),
				update: operation(native?.session?.update, hooks.session?.update),
			},
			user: {
				create: operation(native?.user?.create, hooks.user?.create),
				delete: operation(native?.user?.delete, hooks.user?.delete),
				update: operation(native?.user?.update, hooks.user?.update),
			},
			verification: {
				create: operation(native?.verification?.create, hooks.verification?.create),
				delete: operation(native?.verification?.delete, hooks.verification?.delete),
				update: operation(native?.verification?.update, hooks.verification?.update),
			},
		},
	};
}
