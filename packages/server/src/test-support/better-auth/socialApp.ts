import { Effect } from "effect";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { databaseUrl, postgres } from "@shivaedev/identity/test-support/better-auth/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { socialEngine } from "./socialEngine.ts";
import { socialVerbs } from "./socialVerbs.ts";

const definition = {
	around: withIsolatedDatabase,
	clock: "live",
	inspect: () => ({ location: window.location.href }),
	layer: postgres,
	name: "social auth",
	runIf: databaseUrl !== undefined,
	stages: ["account"],
	verbs: socialVerbs,
} as const;

export const socialApp = storyKit({ ...definition, create: () => socialEngine({}) });
export const tokenlessSocialApp = storyKit({
	...definition,
	create: () =>
		socialEngine({
			databaseHooks: {
				account: {
					create: { before: async (account) => ({ data: { ...account, accessToken: null, idToken: null, refreshToken: null } }) },
					update: { before: async (account) => ({ data: { ...account, accessToken: null, idToken: null, refreshToken: null } }) },
				},
			},
		}),
});

export function mintedSocialSession(providerAccounts: NonNullable<Parameters<typeof signedInUser>[1]["providerAccounts"]> = []) {
	return socialApp.trait("account", "Bob starts signed in with a minted session", function* ({ auth, minted }) {
		const { cookies, user } = yield* Effect.promise(() => signedInUser(auth, { email: "bob@social.test", name: "Bob", providerAccounts }));
		minted.set("Bob", user.id);
		yield* seedCookies(cookies);
	});
}
