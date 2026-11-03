import { Effect } from "effect";
import { passwordUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { NATIVE_ORIGIN, PASSWORD, type RouteState, routeHost } from "./routeHost.ts";
import { routeVerbs } from "./routeVerbs.ts";

export const routes = storyKit({
	after: {
		*configured(state) {
			state.host = yield* routeHost(state.basePath);
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	create: (): RouteState => ({ basePath: undefined, credentials: new Map() }),
	inspect: (state) => ({ basePath: state.basePath, credentials: [...state.credentials.keys()] }),
	layer: postgres,
	name: "mounted auth routes over HTTP",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "account"],
	verbs: routeVerbs,
});

export function configuredPath(basePath?: string) {
	return routes.trait("configured", `auth uses ${basePath ?? "the default path"}`, (state) => {
		state.basePath = basePath;
	});
}

export const aliceWithPassword = routes.trait("account", "alice already has a password account", function* (state) {
	if (state.host === undefined) {
		return yield* Effect.die("Auth routes have not started");
	}
	const user = yield* passwordUser(state.host.auth, { email: "alice@example.test", name: "alice", password: PASSWORD, role: "operator" });
	state.aliceId = user.id;
});

export const previousSession = routes.trait("account", "alice already holds a native bearer for her password account", function* (state) {
	const userId = state.aliceId;
	if (state.host === undefined || userId === undefined) {
		return yield* Effect.die("Alice's password account has not been created");
	}
	const host = state.host;
	const { test } = yield* Effect.promise(() => host.auth.$context);
	const session = yield* Effect.promise(() => test.login({ userId }));
	const token = decodeURIComponent(session.cookies.find((cookie) => cookie.name.endsWith("session_token"))?.value ?? "");
	state.credentials.set("previous", new Headers({ authorization: `Bearer ${token}`, origin: NATIVE_ORIGIN }));
});

export const unverifiedAlice = routes.trait("account", "alice already has an unverified account", function* (state) {
	const host = state.host;
	if (host === undefined) {
		return yield* Effect.die("Auth routes have not started");
	}
	const { test } = yield* Effect.promise(() => host.auth.$context);
	yield* Effect.promise(() => test.saveUser(test.createUser({ email: "alice@example.test", emailVerified: false, name: "alice", role: "operator" })));
});
