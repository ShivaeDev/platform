import { ConfigProvider, Effect } from "effect";
import { answered } from "@shivaedev/test/answers.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { admittedHost } from "./admittedHost.ts";
import { gitHub, gitHubSignIn } from "./gitHub.ts";
import { postgres } from "./postgres.ts";

export const admittedApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const github = gitHub();
		const provider = yield* github.provider;
		yield* routeOutbound({ "api.github.com": provider.url, "github.com": provider.url });
		const env = { "AUTH_ALLOWED_ACCOUNTS": "github:1001,github:1003", "AUTH_RATE_LIMIT_ENABLED": "false" };
		const host = yield* admittedHost(env).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
		return { cookies: new Map<string, string>(), env, github, host, signIns: new Map<string, string>() };
	},
	layer: postgres,
	name: "admitted accounts",
	stages: [],
	verbs: (engine, story) => ({
		allowAliceAgain: () =>
			Effect.sync(() => {
				story.tell("the operator allows alice's GitHub account again after revocation");
				engine.env.AUTH_ALLOWED_ACCOUNTS = "github:1001,github:1003";
			}),
		providerAccounts: (person: "alice" | "bob") => {
			story.tell(`${person} reads provider account IDs over HTTP RPC`);
			return answered(engine.host.providerAccounts(engine.cookies.get(person) ?? ""));
		},
		removeAlice: () =>
			Effect.sync(() => {
				story.tell("the operator removes alice's GitHub account from the allowlist");
				engine.env.AUTH_ALLOWED_ACCOUNTS = "github:1003";
			}),
		revoke: () => {
			story.tell("the operator revokes sessions no longer admitted by the allowlist");
			return engine.host.revoke.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: engine.env }))));
		},
		signIn: (person: "alice" | "bob") =>
			Effect.promise(async () => {
				story.tell(`${person} signs in through the GitHub callback`);
				engine.github.signingIn(person);
				const result = await gitHubSignIn(engine.host.baseUrl);
				if (result.signedIn) {
					engine.cookies.set(person, result.cookie);
				}
				const refused = result.error === "sign_in_refused" ? "refused" : `failed: ${result.error}`;
				engine.signIns.set(person, result.signedIn ? "signed in" : refused);
			}),
		signInAnswer: (person: "alice" | "bob") => Effect.sync(() => engine.signIns.get(person) ?? "no sign-in attempted"),
	}),
});
