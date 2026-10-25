import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AuthUnavailable } from "#errors/taxonomy.ts";
import { Identity, SessionUser } from "#rpc/identity.ts";
import { AuthenticatedUser } from "#rpc/middleware.ts";
import type { OriginPolicy } from "#server/rpc-server/origin.ts";
import { authenticatedUserLayer, type SessionPolicy, type UserSessionShape } from "#server/rpc-server/session.ts";

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
				provider: {
					get: () =>
						Effect.suspend(() => {
							state.lookups += 1;
							state.sessionRequests.push("Whoami");
							return state.session;
						}),
				},
			});
		},
	},
	create: () => {
		const connection: { current?: Effect.Success<ReturnType<typeof openProfile>> } = {};
		const origin: OriginPolicy = () => true;
		const session: Effect.Effect<Option.Option<UserSessionShape>, AuthUnavailable> = Effect.succeed(Option.none());
		const sessionRequests: string[] = [];
		return { connection, lookups: 0, origin, session, sessionRequests };
	},
	name: "RPC profile",
	stages: ["policy"],
	verbs: (state, story) => ({
		lookups: () => state.lookups,
		sessionRequests: () => [...state.sessionRequests],
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
export const forbiddenOrigin = profile.trait("policy", "the origin policy forbids the request", (state) => {
	state.origin = () => false;
});
export const providerOutage = profile.trait("policy", "the session provider is unavailable", (state) => {
	state.session = Effect.fail(new AuthUnavailable({ message: "Unavailable" }));
});
