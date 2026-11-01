import { AsyncLocalStorage } from "node:async_hooks";
import { APIError } from "better-auth/api";
import { type Cause, Context, Effect, Result } from "effect";
import type { BetterAuthHookError } from "#server/better-auth/databaseHooks.ts";

export const hookRuntime = Effect.fnUntraced(function* <R>() {
	const context = yield* Effect.context<R>();
	const requests = new AsyncLocalStorage<{ readonly context: Context.Context<R>; cause?: Cause.Cause<never> }>();
	return {
		runHook: async <A>(hook: () => Effect.Effect<A, BetterAuthHookError, R>, signal: AbortSignal | undefined): Promise<A> => {
			const request = requests.getStore();
			function remember(cause: Cause.Cause<never>) {
				return Effect.sync(() => {
					if (request !== undefined) {
						request.cause = cause;
					}
				});
			}
			const result = await Effect.runPromiseWith(request?.context ?? context)(Effect.suspend(hook).pipe(Effect.result, Effect.tapCause(remember)), {
				signal,
			});
			if (Result.isFailure(result)) {
				throw new APIError("FORBIDDEN", { code: result.failure.code, message: result.failure.message });
			}
			return result.success;
		},
		runRequest: <A>(request: (signal: AbortSignal) => Promise<A>) =>
			Effect.withFiber((fiber) =>
				Effect.gen(function* () {
					const state: { readonly context: Context.Context<R>; cause?: Cause.Cause<never> } = {
						context: Context.merge(context, fiber.context),
					};
					const exit = yield* Effect.exit(Effect.tryPromise((signal) => requests.run(state, () => request(signal))));
					if (state.cause !== undefined) {
						return yield* Effect.failCause(state.cause);
					}
					return yield* exit;
				}),
			),
	};
});
