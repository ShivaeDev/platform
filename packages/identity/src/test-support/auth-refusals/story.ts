import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authCall } from "#client/adapters/authCall.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { ApplicationCode, type Refusals, refusalHost } from "./host.ts";

export const authRefusalsStory = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		const refusals: Refusals = { delivery: false, hook: false, policy: undefined, seed: false };
		return { ...(yield* refusalHost(refusals)), refusals };
	},
	layer: postgres,
	name: "typed authentication refusals",
	runIf: databaseUrl !== undefined,
	stages: ["refusals"],
	verbs: ({ client, credentials, refusals, storedSessions }, story) => ({
		refuse: (source: "policy" | "policy outage" | "role seed" | "database hook" | "email delivery") =>
			Effect.sync(() => {
				story.tell(`the application's ${source} refuses the next request`);
				switch (source) {
					case "policy":
						refusals.policy = "refused";
						break;
					case "policy outage":
						refusals.policy = "unavailable";
						break;
					case "role seed":
						refusals.seed = true;
						break;
					case "database hook":
						refusals.hook = true;
						break;
					case "email delivery":
						refusals.delivery = true;
						break;
				}
			}),
		requestReset: () => {
			story.tell("alice requests a password reset through authCall");
			return authCall(
				(_: undefined, signal) => client.requestPasswordReset({ email: credentials.email }, { signal }),
				ApplicationCode.literals,
			)(undefined);
		},
		signIn: (password = credentials.password) => {
			story.tell("alice signs in with email and password through authCall");
			return authCall((_: undefined, signal) => client.signIn.email({ ...credentials, password }, { signal }), ApplicationCode.literals)(undefined);
		},
		signInWithoutApplicationCodes: () => {
			story.tell("alice signs in through authCall without declaring application codes");
			return authCall((_: undefined, signal) => client.signIn.email(credentials, { signal }))(undefined);
		},
		storedSessions: () => storedSessions,
	}),
});
