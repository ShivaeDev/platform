import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Option, Schema } from "effect";
import { Headers as HttpHeaders, HttpRouter } from "effect/http";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { betterAuthSessions } from "#server/adapters/betterAuthSessions.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";

export type AuthCall = "session lookup" | "provider-account lookup" | "mounted request";
const SessionReply = Schema.Struct({ user: Schema.Struct({ name: Schema.String }) });
const ORIGIN = "http://localhost:3000";

export const sqlInterruptHost = Effect.gen(function* () {
	const options = {
		"baseURL": ORIGIN,
		database: yield* betterAuthDatabase(),
		plugins: [testUtils()],
		secret: "auth-sql-interruption-story-secret-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
	};
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options)
		.pipe(Effect.provide(memoryStore))
		.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
	const calls: Promise<unknown>[] = [];
	function track<A>(call: Promise<A>): Promise<A> {
		calls.push(call);
		return call;
	}
	const handler = mounted.auth.handler;
	mounted.auth.handler = (request) => track(handler(request));
	const app = HttpRouter.toWebHandler(mounted.routes, { disableLogger: true });
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	const provider = betterAuthSessions(
		(headers) => track(mounted.auth.api.getSession({ headers })),
		(headers) => track(mounted.auth.api.listUserAccounts({ headers })),
	);
	return {
		call: Effect.fnUntraced(function* (kind: AuthCall, headers: Headers) {
			if (kind === "mounted request") {
				const reply = yield* Effect.tryPromise((signal) => app.handler(new Request(`${ORIGIN}/api/auth/get-session`, { headers, signal })));
				return Schema.decodeUnknownSync(SessionReply)(yield* Effect.tryPromise(() => reply.json())).user.name;
			}
			const session = Option.getOrThrow(yield* provider.get(HttpHeaders.fromInput(headers)));
			if (kind === "provider-account lookup") {
				return (yield* session.user.providerAccounts).map(({ accountId }) => accountId).join(",");
			}
			return session.user.name;
		}),
		mint: () =>
			signedInUser(mounted.auth, {
				email: "alice@interrupt.test",
				name: "alice",
				providerAccounts: [{ accountId: "alice-github", providerId: "github" }],
			}),
		settled: () => Effect.promise(() => Promise.allSettled(calls)).pipe(Effect.asVoid),
	};
});
