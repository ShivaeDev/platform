import { Effect } from "effect";
import { HttpRouter, HttpServerRequest } from "effect/http";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { betterAuthMcp } from "#adapters/betterAuth.ts";
import { grantedUser, type OauthAuth, oauthGrants } from "#adapters/oauthGrants.ts";

function observe<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.match(effect, {
		onFailure: (error) => ({
			cause: error instanceof Error ? error.cause : undefined,
			failure: error instanceof AuthUnavailable ? "auth unavailable" : String(error),
		}),
		onSuccess: () => ({ cause: undefined, failure: "none" }),
	});
}

const create = Effect.fnUntraced(function* () {
	const failure = new Error("OAuth provider unavailable");
	const state = { rejectConfiguration: false, rejectMetadata: false };
	const auth: OauthAuth = {
		get $context() {
			return Promise.reject(failure);
		},
		api: {
			"getOAuthServerConfig": () => {
				if (state.rejectConfiguration || state.rejectMetadata) {
					return Promise.reject(failure);
				}
				return Promise.resolve({ issuer: "https://auth.test/api/auth" });
			},
		},
		options: {},
	};
	function initialize() {
		return betterAuthMcp({ admitsUser: () => Effect.succeed(true), auth, origin: () => true, resource: "https://auth.test/mcp" });
	}
	const oauth = yield* initialize();
	const handler = yield* HttpRouter.toHttpEffect(oauth.routes);
	return { auth, failure, handler, initialize, state };
});

export const authEdges = storyKit({
	create,
	inspect: ({ state }) => state,
	name: "MCP OAuth adapter failures",
	stages: ["provider"] as const,
	verbs: (engine, story) => ({
		configure: () =>
			Effect.suspend(() => {
				story.tell("the application configures MCP authentication");
				return observe(engine.initialize());
			}),
		loadMetadata: () =>
			Effect.suspend(() => {
				story.tell("a client requests authorization server metadata");
				return observe(
					engine.handler.pipe(
						Effect.provideService(
							HttpServerRequest.HttpServerRequest,
							HttpServerRequest.fromWeb(new Request("https://auth.test/.well-known/oauth-authorization-server/api/auth")),
						),
					),
				);
			}),
		lookupGrant: () =>
			Effect.suspend(() => {
				story.tell("MCP looks up alice's client grant");
				return observe(grantedUser(engine.auth, "alice", "alice-client"));
			}),
		providerFailure: () => Effect.succeed(engine.failure),
		revokeAllClients: () =>
			Effect.suspend(() => {
				story.tell("alice revokes every client");
				return observe(oauthGrants(engine.auth).revokeAllClients("alice"));
			}),
		revokeClient: () =>
			Effect.suspend(() => {
				story.tell("alice revokes her client");
				return observe(oauthGrants(engine.auth).revokeClient("alice", "alice-client"));
			}),
	}),
});

export const configurationRejected = authEdges.trait("provider", "the OAuth provider rejects configuration requests", (engine) =>
	Effect.sync(() => {
		engine.state.rejectConfiguration = true;
	}),
);

export const metadataRejected = authEdges.trait("provider", "the OAuth provider rejects metadata requests", (engine) =>
	Effect.sync(() => {
		engine.state.rejectMetadata = true;
	}),
);
