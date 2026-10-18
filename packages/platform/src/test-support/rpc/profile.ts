import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { AuthUnavailable } from "#errors/taxonomy.ts";
import { Identity, SessionUser } from "#rpc/identity.ts";
import { AuthenticatedUser } from "#rpc/middleware.ts";
import { authenticatedUserLayer, type SessionPolicy, type UserSessionShape } from "#rpc-server/session.ts";

const Api = RpcGroup.make(
	Rpc.make("Whoami", {
		success: Schema.Struct({
			identity: Schema.Struct({ id: Schema.String }),
			identityKeys: Schema.Array(Schema.String),
			profileKeys: Schema.Array(Schema.String),
			user: Schema.Struct({ email: Schema.String, id: Schema.String, name: Schema.String }),
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

export const profile = storyKit({
	create: () => ({ lookups: 0 }),
	name: "RPC profile",
	stages: ["configured"],
	verbs: (state, story) => ({
		lookups: () => state.lookups,
		whoami: (user?: UserSessionShape["user"], allowed = true, outage = false) =>
			Effect.gen(function* () {
				story.tell("the caller requests their session profile");
				const policy = sessionPolicy(state, user, allowed, outage);
				return yield* Effect.gen(function* () {
					const client = yield* RpcTest.makeClient(Api);
					return yield* client.Whoami().pipe(Effect.result);
				}).pipe(Effect.provide(handlers.pipe(Layer.provideMerge(authenticatedUserLayer(policy)))), Effect.scoped);
			}),
	}),
});

function sessionPolicy(
	state: { lookups: number },
	user: UserSessionShape["user"] | undefined,
	allowed: boolean,
	outage: boolean,
): SessionPolicy<UserSessionShape> {
	return {
		origin: () => allowed,
		provider: {
			get: () =>
				Effect.suspend(() => {
					state.lookups += 1;
					return outage
						? Effect.fail(new AuthUnavailable({ message: "Unavailable" }))
						: Effect.succeed(user === undefined ? Option.none() : Option.some({ user }));
				}),
		},
	};
}
