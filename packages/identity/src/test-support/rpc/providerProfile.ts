import { Effect, Layer, Option, Schema, Stream } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { AuthUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Identity, SessionUserWithProviderAccounts } from "#identity.ts";
import { AuthenticatedUserWithProviderAccounts } from "#middleware.ts";
import { authenticatedUserWithProviderAccountsLayer, type ProviderAccountsSessionShape } from "#server/session.ts";

const READS_PER_CALL = 3;

const githubAccount = { accessToken: "github-access-token", accountId: "123", id: "account-row", providerId: "github" };

const Seen = Schema.Record(Schema.String, Schema.Unknown);

const Api = RpcGroup.make(
	Rpc.make("Accounts", {
		error: Schema.Union([AuthUnavailable, Unauthorized]),
		success: Schema.Struct({ accounts: Schema.Array(Seen), identity: Seen }),
	}),
	Rpc.make("ReadAccounts", {
		stream: true,
		success: Schema.Union([Schema.Literals(["auth unavailable", "unauthorized"]), Schema.Array(Seen)]),
	}),
).middleware(AuthenticatedUserWithProviderAccounts);
const handlers = Api.toLayer({
	Accounts: () =>
		Effect.gen(function* () {
			const user = yield* SessionUserWithProviderAccounts;
			const accounts = yield* user.providerAccounts;
			return { accounts: accounts.map((account) => ({ ...account })), identity: { ...(yield* Identity) } };
		}),
	ReadAccounts: () =>
		Stream.range(1, READS_PER_CALL).pipe(
			Stream.mapEffect(() =>
				Effect.gen(function* () {
					const user = yield* SessionUserWithProviderAccounts;
					return yield* user.providerAccounts.pipe(
						Effect.map((accounts) => accounts.map((account) => ({ ...account }))),
						Effect.catch((error) => Effect.succeed(error._tag === "AuthUnavailable" ? ("auth unavailable" as const) : ("unauthorized" as const))),
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

interface State {
	readonly connection: { current?: Effect.Success<ReturnType<typeof openProviderProfile>> };
	readonly lookups: string[];
	user?: ProviderAccountsSessionShape["user"];
}

function connected(state: State) {
	if (state.connection.current === undefined) {
		throw new Error("The provider profile client has not been started");
	}
	return state.connection.current;
}

function alice(state: State, providerAccounts: ProviderAccountsSessionShape["user"]["providerAccounts"]) {
	state.user = {
		email: "alice@example.test",
		id: "alice",
		name: "Alice",
		providerAccounts: Effect.suspend(() => {
			state.lookups.push("alice's provider accounts");
			return providerAccounts;
		}),
	};
}

export const providerProfile = storyKit({
	after: {
		*session(state) {
			if (state.user === undefined) {
				return yield* Effect.die("The story has not said who is signed in");
			}
			state.connection.current = yield* openProviderProfile(state.user);
		},
	},
	create: (): State => ({ connection: {}, lookups: [] }),
	name: "provider profile",
	stages: ["session"],
	verbs: (state, story) => ({
		identity: () => {
			story.tell("a handler reads alice's Identity");
			const { client, services } = connected(state);
			return client.Accounts().pipe(
				Effect.map(({ identity }) => identity),
				Effect.provide(services),
			);
		},
		providerAccounts: () => {
			story.tell("a handler reads alice's provider accounts");
			const { client, services } = connected(state);
			return client.Accounts().pipe(
				Effect.map(({ accounts }) => accounts),
				Effect.provide(services),
			);
		},
		providerLookups: () => Effect.sync(() => [...state.lookups]),
		readAccountsThreeTimes: () => {
			story.tell(`a handler reads alice's provider accounts ${READS_PER_CALL} times in one call`);
			const { client, services } = connected(state);
			return client.ReadAccounts().pipe(
				Stream.runCollect,
				Effect.map((reads) => [...reads]),
				Effect.provide(services),
			);
		},
	}),
});

export const aliceLinkedGitHub = providerProfile.trait(
	"session",
	"alice is signed in, and her provider's account row for GitHub carries an access token and a row id",
	(state) => {
		alice(state, Effect.succeed([githubAccount]));
	},
);

export const firstLookupFails = providerProfile.trait(
	"session",
	"alice is signed in with a GitHub account, and the provider's first account lookup fails as unavailable",
	(state) => {
		alice(
			state,
			Effect.suspend(() =>
				state.lookups.length === 1 ? Effect.fail(new AuthUnavailable({ message: "Temporary outage" })) : Effect.succeed([githubAccount]),
			),
		);
	},
);
