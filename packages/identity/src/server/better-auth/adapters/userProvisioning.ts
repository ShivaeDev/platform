import type { AuthContext } from "better-auth";
import { Effect, Layer, Redacted } from "effect";
import { providerFailure } from "#server/providerFailure.ts";
import { type PasswordUser, UserProvisioning } from "#server/UserProvisioning.ts";

export function betterAuthUserProvisioning(auth: {
	readonly $context: Promise<Pick<AuthContext, "internalAdapter"> & { readonly password: Pick<AuthContext["password"], "hash"> }>;
}) {
	return Layer.succeed(UserProvisioning, {
		findOrCreateUser: Effect.fn("Identity.findOrCreateUser")(function* ({ email, name, password }: PasswordUser) {
			return yield* Effect.tryPromise(async () => {
				const context = await auth.$context;
				const normalized = email.toLowerCase();
				const existing = await context.internalAdapter.findUserByEmail(normalized);
				if (existing !== null) {
					return { email: existing.user.email, id: existing.user.id, name: existing.user.name };
				}
				const hash = await context.password.hash(Redacted.value(password));
				const user = await context.internalAdapter.createUser({ email: normalized, emailVerified: true, name }, { method: "seed" });
				await context.internalAdapter.createAccount({ accountId: user.id, password: hash, providerId: "credential", userId: user.id });
				return { email: user.email, id: user.id, name: user.name };
			}).pipe(Effect.catch((error) => providerFailure(error.cause)));
		}),
	});
}
