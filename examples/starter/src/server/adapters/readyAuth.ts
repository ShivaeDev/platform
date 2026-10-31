import type { AuthContext } from "better-auth";
import { Effect } from "effect";

export const readyAuth = Effect.fn("App.readyAuth")(function* <A extends { readonly $context: Promise<Pick<AuthContext, "checkSchema">> }>(auth: A) {
	yield* Effect.tryPromise(async () => {
		const context = await auth.$context;
		// Better Auth starts this check without joining it to $context.
		await context.checkSchema?.();
	}).pipe(Effect.uninterruptible);
	return auth;
});
