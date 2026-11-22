import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Identity, SessionUser } from "#identity.ts";
import { Authenticated, AuthenticatedUser } from "#middleware.ts";
import type { OriginPolicy } from "#server/origin.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { authenticatedLayer, authenticatedUserLayer, type SessionShape } from "#server/session.ts";
import { recorder } from "#test/rpc/harness.ts";

const Seen = Schema.Record(Schema.String, Schema.Unknown);

const Api = RpcGroup.make(
	Rpc.make("Whoami", { success: Schema.Struct({ identity: Seen, user: Seen }) }).middleware(AuthenticatedUser),
	Rpc.make("WhoamiById", { success: Seen }).middleware(Authenticated),
);
const handlers = Api.toLayer({
	Whoami: () =>
		Effect.gen(function* () {
			return { identity: { ...(yield* Identity) }, user: { ...(yield* SessionUser) } };
		}),
	WhoamiById: () => Effect.map(Identity, (identity) => ({ ...identity })),
});

const openProfile = Effect.fnUntraced(function* (policy: SessionPolicy["Service"]) {
	const services = yield* Layer.build(
		handlers.pipe(
			Layer.provideMerge(Layer.merge(authenticatedUserLayer(), authenticatedLayer())),
			Layer.provide(Layer.succeed(SessionPolicy, policy)),
		),
	);
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
	callerOrigin?: string;
	readonly connection: { current?: Effect.Success<ReturnType<typeof openProfile>> };
	lookups: number;
	origin: OriginPolicy;
	readonly recorded: ReturnType<typeof recorder>;
	session?: Effect.Effect<Option.Option<SessionShape>, AuthUnavailable>;
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

function connected(state: State) {
	if (state.connection.current === undefined) {
		throw new Error("The profile client has not been started");
	}
	return state.connection.current;
}

export const profile = storyKit({
	after: {
		*policy(state) {
			state.connection.current = yield* openProfile({ origin: state.origin, provider: { get: () => storySession(state) } }).pipe(
				Effect.provide(state.recorded.layer),
			);
		},
	},
	create: (): State => ({ connection: {}, lookups: 0, origin: () => true, recorded: recorder() }),
	name: "RPC profile",
	stages: ["policy"],
	verbs: (state, story) => ({
		answer: () => Effect.sync(() => state.answer),
		errors: () => Effect.sync(() => state.recorded.logs.filter((log) => log.level === "Error").map((log) => log.message)),
		sessionLookups: () => Effect.sync(() => state.lookups),
		warnings: () => Effect.sync(() => state.recorded.logs.filter((log) => log.level === "Warn").map((log) => log.message)),
		whoami: () => {
			story.tell("the caller asks a handler what it sees of them");
			const connection = connected(state);
			const headers = state.callerOrigin === undefined ? undefined : { headers: { origin: state.callerOrigin } };
			return connection.client.Whoami(undefined, headers).pipe(
				Effect.catch((error) => Effect.succeed(refusal(error))),
				Effect.tap((answer) =>
					Effect.sync(() => {
						state.answer = answer;
					}),
				),
				Effect.provide(connection.services),
			);
		},
		whoamiById: () => {
			story.tell("the caller asks a handler that reads only their Identity who they are");
			const { client, services } = connected(state);
			return client.WhoamiById().pipe(
				Effect.catch((error) => Effect.succeed(refusal(error))),
				Effect.provide(services),
			);
		},
	}),
});

export const aliceSignedIn = profile.trait("policy", "alice is signed in, and the provider also keeps a private field on her user", (state) => {
	state.session = Effect.succeed(
		Option.some({ user: { email: "alice@example.test", emailVerified: true, id: "alice", name: "Alice", privateField: "provider-only" } }),
	);
});
export const aliceWithoutEmailVerified = profile.trait(
	"policy",
	"alice is signed in through a custom provider whose user carries her id, name and email but no emailVerified",
	(state) => {
		state.session = Effect.succeed(Option.some({ user: { email: "alice@example.test", id: "alice", name: "Alice" } }));
	},
);
export const signedOut = profile.trait("policy", "nobody is signed in", (state) => {
	state.session = Effect.succeed(Option.none());
});
export const originForbidden = profile.trait(
	"policy",
	"the caller comes from https://elsewhere.example, which the origin policy forbids",
	(state) => {
		state.callerOrigin = "https://elsewhere.example";
		state.origin = () => false;
	},
);
export const providerOutage = profile.trait("policy", "the session provider is unavailable", (state) => {
	state.session = Effect.fail(new AuthUnavailable({ message: "Unavailable" }));
});
