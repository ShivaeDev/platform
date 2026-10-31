import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { Effect, Exit } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import type { AccountRoleSeed } from "#server/better-auth/accountRoleSeed.ts";

export function roleSeedOptions<E>(options: BetterAuthOptions, seed: AccountRoleSeed<E> | undefined): BetterAuthOptions {
	if (seed === undefined) {
		return options;
	}
	const own = options.databaseHooks?.session?.create?.before;
	return {
		...options,
		databaseHooks: {
			...options.databaseHooks,
			session: {
				...options.databaseHooks?.session,
				create: {
					...options.databaseHooks?.session?.create,
					before: async (session, endpoint) => {
						const result = await own?.(session, endpoint);
						if (result === false) {
							return result;
						}
						const userId = typeof result === "object" && typeof result.data.userId === "string" ? result.data.userId : session.userId;
						const exit = await Effect.runPromise(
							Effect.exit(seed.onSignIn(userId).pipe(Effect.tapCause((cause) => Effect.logError("Account role seed failed", redact(cause))))),
							{ signal: endpoint?.request?.signal },
						);
						if (Exit.isFailure(exit)) {
							throw new APIError("SERVICE_UNAVAILABLE", { code: "role_seed_failed", message: "Sign-in is temporarily unavailable" });
						}
						return result;
					},
				},
			},
		},
	};
}
