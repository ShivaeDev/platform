import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { Context, type Duration, Effect, Fiber, Layer, Option, Queue, Result, Schema, Stream } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { TestClock } from "effect/testing";
import { AuthUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Identity, OptionalIdentity, SessionUser, SessionUserWithProviderAccounts } from "#identity.ts";
import { Authenticated, AuthenticatedUser, AuthenticatedUserWithProviderAccounts, MaybeAuthenticated } from "#middleware.ts";
import { betterAuthSessions } from "#server/adapters/betterAuthSessions.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { authenticatedLayer, authenticatedUserLayer, authenticatedUserWithProviderAccountsLayer, maybeAuthenticatedLayer } from "#server/session.ts";
import { makeSocketSession, SocketSession } from "#server/socketSession.ts";
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
type Method = "Identity" | "Profile" | "Accounts" | "Optional";

const DEFAULT_INTERVAL = "30 seconds";

function ending(result: Result.Result<void, unknown>) {
	if (Result.isSuccess(result)) {
		return "ended";
	}
	const error = result.failure;
	return error instanceof Unauthorized ? "unauthorized" : `failed: ${String(error)}`;
}

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
		const profilePolicy = {
			...policy,
			get streamRevalidationInterval() {
				return state.interval;
			},
		};
		const handlers = Api.toLayer({
			Accounts: () =>
				Stream.fromQueue(input).pipe(Stream.mapEffect((value) => Effect.map(SessionUserWithProviderAccounts, (user) => `${user.id}: ${value}`))),
			Identity: () => Stream.fromQueue(input).pipe(Stream.mapEffect((value) => Effect.map(Identity, (user) => `${user.id}: ${value}`))),
			Optional: () =>
				Stream.fromQueue(input).pipe(
					Stream.mapEffect((value) => Effect.map(OptionalIdentity, (user) => `${Option.getOrUndefined(user)?.id ?? "anonymous"}: ${value}`)),
				),
			Profile: () => Stream.fromQueue(input).pipe(Stream.mapEffect((value) => Effect.map(SessionUser, (user) => `${user.id}: ${value}`))),
		});
		const services = yield* Layer.build(
			handlers.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						authenticatedLayer(policy),
						authenticatedUserLayer(profilePolicy),
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
	stages: ["policy", "connection", "subscription"],
	verbs: (engine, story) => {
		function subscribed() {
			if (engine.state.subscription === undefined) {
				throw new Error("Nobody has subscribed to a stream");
			}
			return engine.state.subscription;
		}
		return {
			aliceSignsOut: () => {
				story.tell("alice signs out through Better Auth");
				return signOut(engine.provider, { cookie: engine.account.cookie });
			},
			echo: (message: string) => {
				story.tell(`the stream is sent "${message}"`);
				return Queue.offer(engine.input, message).pipe(
					Effect.andThen(
						Effect.raceFirst(
							Queue.take(engine.output).pipe(Effect.map((echoed) => echoed.replace(engine.account.userId, "alice"))),
							subscribed().pipe(Effect.map((end) => `the stream ${end}`)),
						),
					),
				);
			},
			lookupCount: () => engine.provider.lookups(),
			revalidationIntervalPasses: () => {
				const interval = engine.state.interval ?? DEFAULT_INTERVAL;
				story.tell(`${interval} pass and the session is checked again`);
				return TestClock.adjust(interval).pipe(Effect.andThen(Queue.take(engine.checked)));
			},
			sessionStoreBlips: () =>
				Effect.sync(() => {
					story.tell("the next session lookup cannot reach storage");
					engine.state.failures += 1;
				}),
			streamEnd: () => subscribed(),
			streamEnds: () => Effect.all(engine.state.subscriptions),
			timePasses: (duration: Duration.Input) => {
				story.tell(`${duration} pass`);
				return TestClock.adjust(duration);
			},
		};
	},
});

function subscription(method: Method, line: string, signedIn: boolean) {
	return streamSession.trait("subscription", line, (engine) =>
		Effect.gen(function* () {
			const fiber = yield* engine.client[method](undefined, { headers: signedIn ? { cookie: engine.account.cookie } : {} }).pipe(
				Stream.runForEach((value) => Queue.offer(engine.output, value)),
				Effect.result,
				Effect.map(ending),
				Effect.provide(engine.state.shared === undefined ? engine.services : Context.add(engine.services, SocketSession, engine.state.shared)),
				Effect.forkScoped,
			);
			engine.state.subscription = Fiber.join(fiber);
			engine.state.subscriptions.push(Fiber.join(fiber));
			yield* Queue.take(engine.checked);
		}),
	);
}

export function revalidatesEvery(interval: Duration.Input) {
	return streamSession.trait("policy", `the app checks stream sessions every ${interval}`, (engine) => {
		engine.state.interval = interval;
	});
}

export function aliceSubscribesTo(method: Method) {
	return subscription(method, `signed-in alice subscribes to ${method} and her session is checked once`, true);
}

export const anonymousSubscribesToOptional = subscription(
	"Optional",
	"an anonymous caller subscribes to Optional and the missing session is checked once",
	false,
);

export const sharedConnection = streamSession.trait("connection", "one socket owns every stream session check", function* (engine) {
	engine.state.shared = yield* makeSocketSession(engine.state.interval ?? DEFAULT_INTERVAL);
});
