import { type BetterAuthOptions, betterAuth } from "better-auth";
import { Effect } from "effect";
import { signedInUser, signInAgain } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";

export const mintSessions = Effect.fnUntraced(function* (options: BetterAuthOptions, person: string, accountId: string, devices: readonly string[]) {
	const auth = betterAuth(options);
	let login = yield* signedInUser(auth, {
		email: `${person}@github.test`,
		name: person,
		providerAccounts: [{ accountId, providerId: "github" }],
	});
	const authContext = yield* Effect.promise(() => auth.$context);
	for (const [index, device] of devices.entries()) {
		if (index > 0) {
			login = yield* signInAgain(auth, login.user.id);
		}
		const token = login.token;
		yield* Effect.promise(() => authContext.internalAdapter.updateSession(token, { userAgent: device }));
	}
	return login;
});
