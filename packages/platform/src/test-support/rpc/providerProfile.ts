import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { AuthUnavailable, Unauthorized } from "#errors/taxonomy.ts";
import { Identity, SessionUserWithProviderAccounts } from "#rpc/identity.ts";
import { AuthenticatedUserWithProviderAccounts } from "#rpc/middleware.ts";
import { authenticatedUserWithProviderAccountsLayer, type ProviderAccountsSessionShape } from "#server/rpc-server/session.ts";

const Api = RpcGroup.make(
	Rpc.make("Accounts", {
		error: Schema.Union([AuthUnavailable, Unauthorized]),
		success: Schema.Struct({ accounts: Schema.Array(Schema.Unknown), identity: Schema.Struct({ id: Schema.String }) }),
	}),
).middleware(AuthenticatedUserWithProviderAccounts);
const handlers = Api.toLayer({
	Accounts: () =>
		Effect.gen(function* () {
			const user = yield* SessionUserWithProviderAccounts;
			const identity = yield* Identity;
			return { accounts: yield* user.providerAccounts, identity };
		}),
});
const openProviderProfile = Effect.fnUntraced(function* (user: ProviderAccountsSessionShape["user"]) {
	const middleware = authenticatedUserWithProviderAccountsLayer({
		origin: () => true,
		provider: { get: () => Effect.succeed(Option.some({ user })) },
	});
	const services = yield* Layer.build(handlers.pipe(Layer.provideMerge(middleware)));
	const client = yield* RpcTest.makeClient(Api).pipe(Effect.provide(services));
	return { client, services };
});
export const providerProfile = storyKit({
	after: {
		*session(state) {
			state.connection.current = yield* openProviderProfile(state.user);
		},
	},
	create: () => {
		const user: ProviderAccountsSessionShape["user"] = {
			email: "alice@example.test",
			id: "alice",
			name: "Alice",
			providerAccounts: Effect.succeed([]),
		};
		const connection: { current?: Effect.Success<ReturnType<typeof openProviderProfile>> } = {};
		return { connection, user };
	},
	name: "provider profile",
	stages: ["session"],
	verbs: (state, story) => ({
		accounts: () => {
			story.tell("the caller requests provider account IDs");
			const connection = state.connection.current;
			if (connection === undefined) {
				throw new Error("The provider profile client has not been started");
			}
			return connection.client.Accounts().pipe(Effect.provide(connection.services));
		},
	}),
});
export function customAccounts(user: ProviderAccountsSessionShape["user"]) {
	return providerProfile.trait("session", "a custom provider supplies lazy accounts", (state) => {
		state.user = user;
	});
}
