import { Effect, Layer, Option, Schema, Stream } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { AuthUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Identity, SessionUserWithProviderAccounts } from "#identity.ts";
import { AuthenticatedUserWithProviderAccounts } from "#middleware.ts";
import { authenticatedUserWithProviderAccountsLayer, type ProviderAccountsSessionShape } from "#server/session.ts";

const Api = RpcGroup.make(
	Rpc.make("Accounts", {
		error: Schema.Union([AuthUnavailable, Unauthorized]),
		success: Schema.Struct({ accounts: Schema.Array(Schema.Unknown), identity: Schema.Struct({ id: Schema.String }) }),
	}),
	Rpc.make("ReadAccounts", {
		stream: true,
		success: Schema.Union([
			Schema.Struct({ _tag: Schema.Literal("Failure"), error: Schema.String }),
			Schema.Struct({ _tag: Schema.Literal("Success"), accounts: Schema.Array(Schema.Unknown) }),
		]),
	}),
).middleware(AuthenticatedUserWithProviderAccounts);
const handlers = Api.toLayer({
	Accounts: () =>
		Effect.gen(function* () {
			const user = yield* SessionUserWithProviderAccounts;
			const identity = yield* Identity;
			return { accounts: yield* user.providerAccounts, identity };
		}),
	ReadAccounts: () =>
		Stream.range(1, 3).pipe(
			Stream.mapEffect(() =>
				Effect.gen(function* () {
					const user = yield* SessionUserWithProviderAccounts;
					return yield* user.providerAccounts.pipe(
						Effect.map((accounts) => ({ _tag: "Success" as const, accounts })),
						Effect.catch((error) => Effect.succeed({ _tag: "Failure" as const, error: error._tag })),
					);
				}),
			),
		),
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
		const accountRequests: string[] = [];
		return { accountRequests, connection, lookups: 0, user };
	},
	name: "provider profile",
	stages: ["session"],
	verbs: (state, story) => ({
		accountRequests: () => [...state.accountRequests],
		accounts: () => {
			story.tell("the caller requests provider account IDs");
			const connection = state.connection.current;
			if (connection === undefined) {
				throw new Error("The provider profile client has not been started");
			}
			return connection.client.Accounts().pipe(Effect.provide(connection.services));
		},
		lookups: () => state.lookups,
		readAccounts: () => {
			story.tell("the caller reads provider accounts three times in one stream");
			const connection = state.connection.current;
			if (connection === undefined) {
				throw new Error("The provider profile client has not been started");
			}
			return connection.client.ReadAccounts().pipe(Stream.runCollect, Effect.provide(connection.services));
		},
	}),
});
export function customAccounts(user: ProviderAccountsSessionShape["user"]) {
	return providerProfile.trait("session", "a custom provider supplies lazy accounts", (state) => {
		state.user = user;
	});
}
export const transientAccountsFailure = providerProfile.trait("session", "the first provider-account lookup fails transiently", (state) => {
	state.user = {
		...state.user,
		providerAccounts: Effect.suspend(() => {
			state.lookups += 1;
			state.accountRequests.push(state.user.id);
			return state.lookups === 1
				? Effect.fail(new AuthUnavailable({ message: "Temporary outage" }))
				: Effect.succeed([{ accountId: "123", providerId: "github" }]);
		}),
	};
});
