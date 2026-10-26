import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { type Duration, Effect, Fiber, Layer, Option, Queue, Schema, Stream } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { TestClock } from "effect/testing";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { Identity, OptionalIdentity, SessionUser, SessionUserWithProviderAccounts } from "@shivaedev/platform/rpc/identity.ts";
import { Authenticated, AuthenticatedUser, AuthenticatedUserWithProviderAccounts, MaybeAuthenticated } from "@shivaedev/platform/rpc/middleware.ts";
import { signedInUser } from "@shivaedev/platform/server/better-auth/testing.ts";
import { betterAuthSessions } from "@shivaedev/platform/server/rpc-server/adapters/betterAuthSessions.ts";
import {
	authenticatedLayer,
	authenticatedUserLayer,
	authenticatedUserWithProviderAccountsLayer,
	maybeAuthenticatedLayer,
} from "@shivaedev/platform/server/rpc-server/session.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createProvider } from "./harness.ts";
import { databaseUrl, postgres } from "./postgres.ts";
import { signOut } from "./sessionLifecycle.ts";

const Api = RpcGroup.make(Rpc.make("Identity", { stream: true, success: Schema.String }))
	.middleware(Authenticated)
	.merge(
		RpcGroup.make(Rpc.make("Profile", { stream: true, success: Schema.String })).middleware(AuthenticatedUser),
		RpcGroup.make(Rpc.make("Accounts", { stream: true, success: Schema.String })).middleware(AuthenticatedUserWithProviderAccounts),
		RpcGroup.make(Rpc.make("Optional", { stream: true, success: Schema.String })).middleware(MaybeAuthenticated),
	);
export const streamSession = storyKit({
	around: withIsolatedDatabase,
	*create() {
		const database = yield* PostgresTestDatabase;
		const provider = yield* createProvider(database.url);
		const mintingAuth = betterAuth({ ...provider.auth.options, plugins: [testUtils()] });
		const session = yield* Effect.promise(() => signedInUser(mintingAuth, { email: "alice@example.test", name: "Alice" }));
		const cookie = session.headers.get("cookie");
		if (cookie === null) {
			return yield* Effect.die("The minted session did not supply a cookie");
		}
		const account = { cookie, userId: session.user.id };
		const input = yield* Queue.unbounded<string>();
		const output = yield* Queue.unbounded<string>();
		const checked = yield* Queue.unbounded<void>();
		const state: { failures: number; interval?: Duration.Input } = { failures: 0 };
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
		const handlers = Api.toLayer({
			Accounts: () =>
				Stream.fromQueue(input).pipe(Stream.mapEffect((value) => Effect.map(SessionUserWithProviderAccounts, (user) => `${user.id}:${value}`))),
			Identity: () => Stream.fromQueue(input).pipe(Stream.mapEffect((value) => Effect.map(Identity, (user) => `${user.id}:${value}`))),
			Optional: () =>
				Stream.fromQueue(input).pipe(
					Stream.mapEffect((value) => Effect.map(OptionalIdentity, (user) => `${Option.getOrUndefined(user)?.id ?? "anonymous"}:${value}`)),
				),
			Profile: () => Stream.fromQueue(input).pipe(Stream.mapEffect((value) => Effect.map(SessionUser, (user) => `${user.id}:${value}`))),
		});
		const services = yield* Layer.build(
			handlers.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						authenticatedLayer(policy),
						authenticatedUserLayer(policy),
						authenticatedUserWithProviderAccountsLayer(policy),
						maybeAuthenticatedLayer(policy),
					),
				),
			),
		);
		const client = yield* RpcTest.makeClient(Api).pipe(Effect.provide(services));
		return { account, checked, client, input, output, provider, services, state };
	},
	layer: postgres,
	name: "stream session",
	runIf: databaseUrl !== undefined,
	stages: ["policy"],
	verbs: (state, story) => ({
		advance: (duration: Duration.Input) => TestClock.adjust(duration),
		blip: () =>
			Effect.sync(() => {
				story.tell("the next session lookup cannot reach storage");
				state.state.failures += 1;
			}),
		checked: () => Queue.take(state.checked),
		next: () => Queue.take(state.output),
		send: (value: string) => Queue.offer(state.input, value),
		signout: () => {
			story.tell("Alice signs out through Better Auth");
			return signOut(state.provider, { cookie: state.account.cookie });
		},
		start: (method: "Identity" | "Profile" | "Accounts" | "Optional", signedIn = true) => {
			story.tell(`Alice subscribes to ${method}`);
			return state.client[method](undefined, { headers: signedIn ? { cookie: state.account.cookie } : {} }).pipe(
				Stream.runForEach((value) => Queue.offer(state.output, value)),
				Effect.result,
				Effect.provide(state.services),
				Effect.forkScoped,
				Effect.map((fiber) => Fiber.join(fiber)),
			);
		},
		userId: () => state.account.userId,
	}),
});
export function revalidationInterval(interval: Duration.Input) {
	return streamSession.trait("policy", "the app selects its stream session interval", (state) => {
		state.state.interval = interval;
	});
}
