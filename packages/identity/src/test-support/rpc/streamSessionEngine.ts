import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { type Duration, Effect, Layer, Option, Queue, Schema, Stream } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { Identity, OptionalIdentity, SessionUser, SessionUserWithProviderAccounts } from "#identity.ts";
import { Authenticated, AuthenticatedUser, AuthenticatedUserWithProviderAccounts, MaybeAuthenticated } from "#middleware.ts";
import { betterAuthSessions } from "#server/adapters/betterAuthSessions.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { authenticatedLayer, authenticatedUserLayer, authenticatedUserWithProviderAccountsLayer, maybeAuthenticatedLayer } from "#server/session.ts";
import type { SocketSession } from "#server/socketSession.ts";
import { createProvider } from "./harness.ts";

const Api = RpcGroup.make(Rpc.make("identity", { stream: true, success: Schema.String }))
	.middleware(Authenticated)
	.merge(
		RpcGroup.make(Rpc.make("profile", { stream: true, success: Schema.String })).middleware(AuthenticatedUser),
		RpcGroup.make(Rpc.make("accounts", { stream: true, success: Schema.String })).middleware(AuthenticatedUserWithProviderAccounts),
		RpcGroup.make(Rpc.make("optional", { stream: true, success: Schema.String })).middleware(MaybeAuthenticated),
	);

export const streamSessionEngine = Effect.fnUntraced(function* () {
	const provider = yield* createProvider();
	const mintingAuth = betterAuth({ ...provider.auth.options, plugins: [testUtils()] });
	const session = yield* signedInUser(mintingAuth, { email: "alice@example.test", name: "Alice" });
	const cookie = session.headers.get("cookie");
	if (cookie === null) {
		return yield* Effect.die("The minted session did not supply a cookie");
	}
	const account = { cookie, userId: session.user.id };
	const input = yield* Queue.unbounded<string>();
	const output = yield* Queue.unbounded<string>();
	const checked = yield* Queue.unbounded<void>();
	const state: {
		failures: number;
		interval?: Duration.Input;
		shared?: SocketSession["Service"];
		subscription?: Effect.Effect<string>;
		subscriptions: Effect.Effect<string>[];
	} = { failures: 0, subscriptions: [] };
	const sessions = betterAuthSessions(provider.getSession, async () => []);
	const policy = {
		origin: () => true,
		provider: {
			get: (headers: Parameters<typeof sessions.get>[0]) =>
				Effect.suspend(() => {
					if (state.failures > 0) {
						state.failures -= 1;
						return Effect.fail(new AuthUnavailable({ message: "Session store blip" })).pipe(Effect.ensuring(Queue.offer(checked, undefined)));
					}
					return sessions.get(headers).pipe(Effect.ensuring(Queue.offer(checked, undefined)));
				}),
		},
		get streamRevalidationInterval() {
			return state.interval;
		},
	};
	const handlers = streamHandlers(input);
	const services = yield* Layer.build(
		handlers.pipe(
			Layer.provideMerge(
				Layer.mergeAll(authenticatedLayer(), authenticatedUserLayer(), authenticatedUserWithProviderAccountsLayer(), maybeAuthenticatedLayer()),
			),
			Layer.provide(Layer.succeed(SessionPolicy, policy)),
		),
	);
	const client = yield* RpcTest.makeClient(Api).pipe(Effect.provide(services));
	return { account, checked, client, input, output, provider, services, state };
});

function streamHandlers(input: Queue.Queue<string>) {
	return Api.toLayer({
		accounts: () =>
			Stream.fromQueue(input).pipe(Stream.mapEffect((value) => Effect.map(SessionUserWithProviderAccounts, (user) => `${user.id}: ${value}`))),
		identity: () => Stream.fromQueue(input).pipe(Stream.mapEffect((value) => Effect.map(Identity, (user) => `${user.id}: ${value}`))),
		optional: () =>
			Stream.fromQueue(input).pipe(
				Stream.mapEffect((value) => Effect.map(OptionalIdentity, (user) => `${Option.getOrUndefined(user)?.id ?? "anonymous"}: ${value}`)),
			),
		profile: () => Stream.fromQueue(input).pipe(Stream.mapEffect((value) => Effect.map(SessionUser, (user) => `${user.id}: ${value}`))),
	});
}
