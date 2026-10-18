import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { AuthUnavailable } from "#errors/taxonomy.ts";
import { Identity, SessionUser } from "#rpc/identity.ts";
import { AuthenticatedUser } from "#rpc/middleware.ts";
import { betterAuthSessions, type GetProviderAccounts } from "#server/rpc-server/adapters/betterAuthSessions.ts";
import type { OriginPolicy } from "#server/rpc-server/origin.ts";
import { authenticatedUserLayer, type SessionPolicy, type SessionProvider, type UserSessionShape } from "#server/rpc-server/session.ts";

const Api = RpcGroup.make(
	Rpc.make("Whoami", {
		success: Schema.Struct({
			identity: Schema.Struct({ id: Schema.String }),
			identityKeys: Schema.Array(Schema.String),
			profileKeys: Schema.Array(Schema.String),
			user: Schema.Struct({
				email: Schema.String,
				id: Schema.String,
				name: Schema.String,
				providerAccounts: Schema.optional(Schema.Array(Schema.Unknown)),
			}),
		}),
	}),
).middleware(AuthenticatedUser);
const handlers = Api.toLayer({
	Whoami: () =>
		Effect.gen(function* () {
			const identity = yield* Identity;
			const user = yield* SessionUser;
			return {
				identity,
				identityKeys: Object.keys(identity).sort((a, b) => a.localeCompare(b)),
				profileKeys: Object.keys(user).sort((a, b) => a.localeCompare(b)),
				user,
			};
		}),
});

const openProfile = Effect.fnUntraced(function* (policy: SessionPolicy<UserSessionShape>) {
	const services = yield* Layer.build(handlers.pipe(Layer.provideMerge(authenticatedUserLayer(policy))));
	const client = yield* RpcTest.makeClient(Api).pipe(Effect.provide(services));
	return { client, services };
});

export const profile = storyKit({
	after: {
		*policy(state) {
			state.connection.current = yield* openProfile({
				origin: state.origin,
				provider: state.adapter.current ?? {
					get: () =>
						Effect.suspend(() => {
							state.lookups += 1;
							return state.session;
						}),
				},
			});
		},
	},
	create: () => {
		const adapter: { current?: SessionProvider<UserSessionShape> } = {};
		const connection: { current?: Effect.Success<ReturnType<typeof openProfile>> } = {};
		const origin: OriginPolicy = () => true;
		const session: Effect.Effect<Option.Option<UserSessionShape>, AuthUnavailable> = Effect.succeed(Option.none());
		return { adapter, connection, lookups: 0, origin, session };
	},
	name: "RPC profile",
	stages: ["policy"],
	verbs: (state, story) => ({
		lookups: () => state.lookups,
		whoami: () => {
			story.tell("the caller requests their session profile");
			const connection = state.connection.current;
			if (connection === undefined) {
				throw new Error("The profile client has not been started");
			}
			return connection.client.Whoami().pipe(Effect.result, Effect.provide(connection.services));
		},
	}),
});

export function sessionUser(user: UserSessionShape["user"]) {
	return profile.trait("policy", "the provider has a signed-in session user", (state) => {
		state.session = Effect.succeed(Option.some({ user }));
	});
}
export function betterAuthUser(user: UserSessionShape["user"], getAccounts: GetProviderAccounts) {
	return profile.trait("policy", "Better Auth provides the signed-in user's linked accounts", (state) => {
		state.adapter.current = betterAuthSessions(() => Promise.resolve({ user }), getAccounts);
	});
}
export const forbiddenOrigin = profile.trait("policy", "the origin policy forbids the request", (state) => {
	state.origin = () => false;
});
export const providerOutage = profile.trait("policy", "the session provider is unavailable", (state) => {
	state.session = Effect.fail(new AuthUnavailable({ message: "Unavailable" }));
});
