import type { BetterAuthOptions } from "better-auth";
import { verifyPassword } from "better-auth/crypto";
import { Effect } from "effect";
import { providerFailure } from "#server/providerFailure.ts";

// Better Auth's context resolves the verifier the same way, so a custom hash in the options is checked by its own verify.
export function passwordMatches(options: BetterAuthOptions, hash: string, password: string) {
	const verify = options.emailAndPassword?.password?.verify ?? verifyPassword;
	return Effect.tryPromise(() => verify({ hash, password })).pipe(Effect.catch(providerFailure));
}
