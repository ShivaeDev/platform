import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Identity, SessionUser } from "#identity.ts";
import { AuthenticatedUser } from "#middleware.ts";
import type { OriginPolicy } from "#server/origin.ts";
import { authenticatedUserLayer, type SessionPolicy, type UserSessionShape } from "#server/session.ts";

const Seen = Schema.Record(Schema.String, Schema.Unknown);

const Api = RpcGroup.make(Rpc.make("Whoami", { success: Schema.Struct({ identity: Seen, user: Seen }) })).middleware(AuthenticatedUser);
const handlers = Api.toLayer({
	Whoami: () =>
		Effect.gen(function* () {
			return { identity: { ...(yield* Identity) }, user: { ...(yield* SessionUser) } };
		}),
});

const openProfile = Effect.fnUntraced(function* (policy: SessionPolicy<UserSessionShape>) {
	const services = yield* Layer.build(handlers.pipe(Layer.provideMerge(authenticatedUserLayer(policy))));
	const client = yield* RpcTest.makeClient(Api).pipe(Effect.provide(services));
	return { client, services };
});

function refusal(error: unknown) {
	if (error instanceof Forbidden) {
		return "forbidden";
	}
	if (error instanceof Unauthorized) {
		return "unauthorized";
	}
	if (error instanceof AuthUnavailable) {
		return "auth unavailable";
	}
	return `failed: ${String(error)}`;
}

interface State {
	answer?: unknown;
	readonly connection: { current?: Effect.Success<ReturnType<typeof openProfile>> };
	lookups: number;
	origin: OriginPolicy;
	session?: Effect.Effect<Option.Option<UserSessionShape>, AuthUnavailable>;
}

function storySession(state: State) {
	return Effect.suspend(() => {
		state.lookups += 1;
		if (state.session === undefined) {
			return Effect.die("The story has not said whether anyone is signed in");
		}
		return state.session;
	});
}

export const profile = storyKit({
	after: {
		*policy(state) {
			state.connection.current = yield* openProfile({ origin: state.origin, provider: { get: () => storySession(state) } });
		},
	},
	create: (): State => ({ connection: {}, lookups: 0, origin: () => true }),
	name: "RPC profile",
	stages: ["policy"],
	verbs: (state, story) => ({
		answer: () => Effect.sync(() => state.answer),
		sessionLookups: () => Effect.sync(() => state.lookups),
		whoami: () => {
			story.tell("the caller asks a handler what it sees of them");
			const connection = state.connection.current;
			if (connection === undefined) {
				throw new Error("The profile client has not been started");
			}
			return connection.client.Whoami().pipe(
				Effect.catch((error) => Effect.succeed(refusal(error))),
				Effect.tap((answer) =>
					Effect.sync(() => {
						state.answer = answer;
					}),
				),
				Effect.provide(connection.services),
			);
		},
	}),
});

export const aliceSignedIn = profile.trait("policy", "alice is signed in, and the provider also keeps a private field on her user", (state) => {
	state.session = Effect.succeed(Option.some({ user: { email: "alice@example.test", id: "alice", name: "Alice", privateField: "provider-only" } }));
});
export const signedOut = profile.trait("policy", "nobody is signed in", (state) => {
	state.session = Effect.succeed(Option.none());
});
export const originForbidden = profile.trait("policy", "the origin policy forbids the request", (state) => {
	state.origin = () => false;
});
export const providerOutage = profile.trait("policy", "the session provider is unavailable", (state) => {
	state.session = Effect.fail(new AuthUnavailable({ message: "Unavailable" }));
});
