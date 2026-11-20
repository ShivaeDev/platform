import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authCall } from "#client/adapters/authCall.ts";
import { ApplicationCode, type Refusals, refusalHost } from "#test/auth-refusals/host.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

interface RefusalEngine {
	host?: Effect.Success<ReturnType<typeof refusalHost>>;
	readonly refusals: Refusals;
	signInPolicy: boolean;
}

function started(engine: RefusalEngine) {
	if (engine.host === undefined) {
		throw new Error("The auth refusal host has not started");
	}
	return engine.host;
}

export const authRefusalsStory = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (engine: RefusalEngine) {
			engine.host = yield* refusalHost(engine.refusals, engine.signInPolicy);
		}),
	},
	around: withIdentityDatabase,
	clock: storyClock,
	create: (): RefusalEngine => ({ refusals: { delivery: false, hook: false, policy: undefined, seed: false }, signInPolicy: true }),
	layer: postgres,
	name: "typed authentication refusals",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "refusals"],
	verbs: (engine, story) => ({
		refuse: (source: "policy" | "policy outage" | "role seed" | "database hook" | "email delivery") =>
			Effect.sync(() => {
				story.tell(`the application's ${source} refuses the next request`);
				switch (source) {
					case "policy":
						engine.refusals.policy = "refused";
						break;
					case "policy outage":
						engine.refusals.policy = "unavailable";
						break;
					case "role seed":
						engine.refusals.seed = true;
						break;
					case "database hook":
						engine.refusals.hook = true;
						break;
					case "email delivery":
						engine.refusals.delivery = true;
						break;
				}
			}),
		requestReset: () => {
			story.tell("alice requests a password reset through authCall");
			const { client, credentials } = started(engine);
			return authCall(
				(_: undefined, signal) => client.requestPasswordReset({ email: credentials.email }, { signal }),
				ApplicationCode.literals,
			)(undefined);
		},
		signIn: (password?: string) => {
			story.tell("alice signs in with email and password through authCall");
			const { client, credentials } = started(engine);
			return authCall(
				(_: undefined, signal) => client.signIn.email({ ...credentials, password: password ?? credentials.password }, { signal }),
				ApplicationCode.literals,
			)(undefined);
		},
		signInWithoutApplicationCodes: () => {
			story.tell("alice signs in through authCall without declaring application codes");
			const { client, credentials } = started(engine);
			return authCall((_: undefined, signal) => client.signIn.email(credentials, { signal }))(undefined);
		},
		signUp: () => {
			story.tell("bob signs up with email and password through authCall, and the mount sends his account confirmation");
			const { client, credentials } = started(engine);
			return authCall(
				(_: undefined, signal) => client.signUp.email({ email: "bob@example.test", name: "bob", password: credentials.password }, { signal }),
				ApplicationCode.literals,
			)(undefined);
		},
		storedSessions: () => started(engine).storedSessions,
		storedUsers: () => started(engine).storedUsers,
	}),
});

export const withoutSignInPolicy = authRefusalsStory.trait("configured", "the mount has no sign-in policy, so email sign-up is open", (engine) => {
	engine.signInPolicy = false;
});
