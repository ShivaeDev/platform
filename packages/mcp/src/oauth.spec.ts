import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { mcp } from "#test/mcp.ts";
import { holdsToken, jwksUnavailable, jwksUnreachable, REFUSED_TOKENS, signedIn } from "#test/traits.ts";

mcp.it(
	"an unreachable JWKS endpoint answers 503 without an OAuth restart challenge",
	[signedIn("alice", "user"), holdsToken("alice"), jwksUnreachable],
	function* ({ connects, oauthChallenge }) {
		const answer = yield* connects("alice");

		expect(answer).toBe("auth unavailable");
		expect(yield* oauthChallenge()).toBe("no challenge");
	},
);

mcp.it(
	"alice's client, authorized by alice through OAuth, connects with its token and whoami answers it with alice",
	[signedIn("alice", "user")],
	function* ({ authorizes, call, connects, consents, exchangesCode, registersClient }) {
		yield* registersClient("alice");
		yield* authorizes("alice");
		yield* consents("alice");
		yield* exchangesCode("alice");
		yield* connects("alice");

		expect(yield* call("alice", "whoami")).toBe("answered alice");
	},
);

mcp.it(
	"a client without a token is refused as unauthorized and pointed to the resource metadata at /.well-known/oauth-protected-resource/mcp",
	[],
	function* ({ connectsWithoutToken, lastRefusal }) {
		yield* connectsWithoutToken();

		expect(yield* lastRefusal()).toBe("unauthorized, pointed to the resource metadata at /.well-known/oauth-protected-resource/mcp");
	},
);

mcp.it(
	"the resource metadata names /mcp as the resource, /api/auth as its authorization server and mcp as its scope",
	[],
	function* ({ resourceMetadata }) {
		expect(yield* resourceMetadata()).toEqual({ authorizationServers: ["/api/auth"], resource: "/mcp", scopes: ["mcp"] });
	},
);

mcp.it(
	"the authorization server the resource metadata names publishes /api/auth/oauth2/token as its token endpoint",
	[],
	function* ({ tokenEndpointOfItsAuthorizationServer }) {
		expect(yield* tokenEndpointOfItsAuthorizationServer()).toBe("/api/auth/oauth2/token");
	},
);

for (const kind of REFUSED_TOKENS) {
	mcp.it(
		`alice's client holding an access token ${kind} is refused as unauthorized`,
		[signedIn("alice", "user"), holdsToken("alice", kind)],
		function* ({ connects }) {
			expect(yield* connects("alice")).toBe("unauthorized");
		},
	);
}

mcp.it(
	"a JWKS outage answers 503 without an OAuth restart challenge and logs the failure with secrets redacted",
	[signedIn("alice", "user"), holdsToken("alice"), jwksUnavailable],
	function* ({ bearerFailureLogs, connects, oauthChallenge }) {
		const answer = yield* connects("alice");

		expect(answer).toBe("auth unavailable");
		yield* outcomes({
			"OAuth restart challenge": [oauthChallenge(), "no challenge"],
			"recorded bearer failure": [
				bearerFailureLogs(),
				[["MCP authentication verification failed", expect.objectContaining({ message: "Jwks failed: JWKS unavailable token=<redacted>" })]],
			],
		});
	},
);
