import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { seedCookies } from "@shivaedev/test-story/server/adapters/seedCookies.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { socialEngine } from "#test/better-auth/socialEngine.ts";
import { socialVerbs } from "#test/better-auth/socialVerbs.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

const definition = {
	around: withIdentityDatabase,
	clock: storyClock,
	inspect: () => ({ location: window.location.href }),
	layer: postgres,
	name: "social auth",
	runIf: databaseUrl !== undefined,
	stages: ["account"],
	verbs: socialVerbs,
} as const;

export const socialApp = storyKit({ ...definition, create: () => socialEngine() });
export function mintedSocialSession(providerAccounts: NonNullable<Parameters<typeof signedInUser>[1]["providerAccounts"]> = []) {
	return socialApp.trait("account", "Bob starts signed in with a minted session", function* ({ auth, minted }) {
		const { cookies, user } = yield* signedInUser(auth, { email: "bob@social.test", name: "Bob", providerAccounts });
		minted.set("Bob", user.id);
		yield* seedCookies(cookies);
	});
}
