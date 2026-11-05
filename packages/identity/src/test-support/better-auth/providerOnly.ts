import { Effect, Schema } from "effect";
import { signedInUser, storedProviderAccounts } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { gitHubSignIn } from "#test/sign-in-policy/flows.ts";
import { oauthProvider } from "./oauthProvider.ts";
import { providerOnlyHost } from "./providerOnlyHost.ts";

interface Engine {
	cookie: string;
	disabledPaths: string[];
	enabledPaths: string[];
	host?: Effect.Success<ReturnType<typeof providerOnlyHost>>;
	preset: boolean;
}

function host(engine: Engine) {
	if (engine.host === undefined) {
		throw new Error("Provider-only host has not started");
	}
	return engine.host;
}

const Session = Schema.NullOr(Schema.Struct({ user: Schema.Struct({ name: Schema.String }) }));
const Users = Schema.Struct({ users: Schema.Array(Schema.Struct({ name: Schema.String })) });

export const providerOnly = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (engine: Engine) {
			const provider = yield* oauthProvider({ idToken: "story-id-token", refreshToken: "story-refresh-token" });
			yield* routeOutbound({ "api.github.com": provider.url, "github.com": provider.url });
			engine.host = yield* providerOnlyHost(engine.enabledPaths, engine.disabledPaths, engine.preset);
		}),
	},
	around: withIdentityDatabase,
	clock: storyClock,
	create: (): Engine => ({ cookie: "", disabledPaths: [], enabledPaths: [], preset: true }),
	layer: postgres,
	name: "provider-only auth mount",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "account"],
	verbs: (engine, story) => ({
		accountHookCalls: () => Effect.sync(() => [...host(engine).accountHooks]),
		browserCookieNames: () => Effect.sync(() => engine.cookie.split("; ").map((cookie) => cookie.split("=")[0])),
		call: (path: string, method = "POST", body: object = {}) =>
			Effect.promise(async () => {
				story.tell(`alice calls ${method} ${path} through the mount`);
				const { baseUrl, headers } = host(engine);
				const response = await fetch(`${baseUrl}/api/auth${path}`, {
					...(method === "GET" ? {} : { body: JSON.stringify(body) }),
					headers: { ...Object.fromEntries(headers), "content-type": "application/json", origin: baseUrl },
					method,
					redirect: "manual",
				});
				const responseBody: unknown = response.headers.get("content-type")?.includes("application/json")
					? await response.json()
					: await response.text();
				return { body: responseBody, status: response.status };
			}),
		expireSessions: () =>
			Effect.gen(function* () {
				story.tell("the stored sessions expire");
				const storage = yield* authTestDatabase;
				yield* storage.expireSessions();
			}),
		listUsers: () =>
			Effect.promise(async () => {
				story.tell("alice lists users through the mounted admin endpoint");
				const { baseUrl, headers } = host(engine);
				const response = await fetch(`${baseUrl}/api/auth/admin/list-users`, { headers });
				return { names: Schema.decodeUnknownSync(Users)(await response.json()).users.map(({ name }) => name), status: response.status };
			}),
		session: () =>
			Effect.promise(async () => {
				const response = await fetch(`${host(engine).baseUrl}/api/auth/get-session`, { headers: { cookie: engine.cookie } });
				return Schema.decodeUnknownSync(Session)(await response.json())?.user.name ?? "signed out";
			}),
		signIn: () =>
			Effect.promise(async () => {
				story.tell("Alice signs in through the fake GitHub provider");
				const result = await gitHubSignIn(host(engine).baseUrl, "123", "browser");
				if (!result.signedIn) {
					throw new Error(`GitHub sign-in failed: ${result.error}`);
				}
				engine.cookie = result.cookie;
			}),
		storedProviderAccounts: () =>
			Effect.promise(async () => {
				const { auth } = host(engine);
				const { internalAdapter } = await auth.$context;
				const user = await internalAdapter.findUserByEmail("alice@social.test");
				if (user === null) {
					throw new Error("GitHub sign-in created no user");
				}
				return storedProviderAccounts(auth, user.user.id);
			}),
	}),
});

export const adminListEnabled = providerOnly.trait("configured", "the app explicitly re-enables the admin user list", (engine) => {
	engine.enabledPaths.push("/admin/list-users");
});

export const adminListDisabled = providerOnly.trait("configured", "the app also disables the admin user list in Better Auth options", (engine) => {
	engine.disabledPaths.push("/admin/list-users");
});

export const withoutPreset = providerOnly.trait("configured", "the app does not select a preset", (engine) => {
	engine.preset = false;
});

export const emailEndpointEnabled = providerOnly.trait("configured", "the app re-enables the email sign-in endpoint", (engine) => {
	engine.enabledPaths.push("/sign-in/email");
});

export const signedInProviderUser = providerOnly.trait("account", "Alice already has a GitHub session", function* (engine) {
	const { headers } = yield* signedInUser(host(engine).auth, {
		email: "alice@social.test",
		name: "Alice",
		providerAccounts: [{ accountId: "123", providerId: "github" }],
	});
	engine.cookie = headers.get("cookie") ?? "";
});
