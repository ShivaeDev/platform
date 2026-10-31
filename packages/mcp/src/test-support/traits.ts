import { DateTime, Effect } from "effect";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { connects } from "./client.ts";
import { type Engine, person } from "./host.ts";
import { mcp } from "./mcp.ts";

function sign(engine: Engine, payload: Record<string, string | number>) {
	return Effect.promise(async () => (await engine.auth.api.signJWT({ body: { payload } })).token);
}

function claims(engine: Engine, name: string, client: string) {
	return { aud: engine.resource, "client_id": engine.clientIds.get(client) ?? "", iss: engine.issuer, scope: "mcp", sub: person(engine, name).id };
}

export const REFUSED_TOKENS = [
	"for another resource, https://other.test/mcp",
	"issued by https://other.test/api/auth",
	"that is not a JWT",
	"that has expired",
	"whose claims were altered after signing",
	"with the scope other instead of mcp",
] as const;
export type TokenKind = "for this endpoint" | (typeof REFUSED_TOKENS)[number];

const TOKENS: Record<TokenKind, (engine: Engine, name: string, client: string) => Effect.Effect<string>> = {
	"for another resource, https://other.test/mcp": (engine, name, client) =>
		sign(engine, { ...claims(engine, name, client), aud: "https://other.test/mcp" }),
	"for this endpoint": (engine, name, client) => sign(engine, claims(engine, name, client)),
	"issued by https://other.test/api/auth": (engine, name, client) =>
		sign(engine, { ...claims(engine, name, client), iss: "https://other.test/api/auth" }),
	"that has expired": (engine, name, client) => sign(engine, { ...claims(engine, name, client), exp: 1 }),
	"that is not a JWT": () => Effect.succeed("not-a-jwt"),
	"whose claims were altered after signing": (engine, name, client) =>
		Effect.map(sign(engine, claims(engine, name, client)), (token) => {
			const [header, , signature] = token.split(".");
			const altered = Buffer.from(JSON.stringify({ ...claims(engine, name, client), altered: true })).toString("base64url");
			return `${header}.${altered}.${signature}`;
		}),
	"with the scope other instead of mcp": (engine, name, client) => sign(engine, { ...claims(engine, name, client), scope: "other" }),
};

export function signedIn(name: string, role: "admin" | "user") {
	return mcp.trait("people", `${name} is signed in as ${role === "admin" ? "an admin" : "a user"}`, function* (engine) {
		const session = yield* Effect.promise(() => signedInUser(engine.auth, { email: `${name}@mcp.test`, name, role }));
		engine.people.set(name, { cookie: session.headers.get("cookie") ?? "", id: session.user.id });
	});
}

export function holdsToken(name: string, kind: TokenKind = "for this endpoint", client = name) {
	return mcp.trait("tokens", `${name}'s ${client} client holds an access token ${kind}`, function* (engine) {
		// Minted grants keep authentication preconditions independent of the browser OAuth flow.
		const { adapter } = yield* Effect.promise(() => engine.auth.$context);
		const clientId = `${client}-client`;
		const now = DateTime.toDateUtc(yield* DateTime.now);
		yield* Effect.promise(() => adapter.create({ data: { clientId, redirectUris: ["http://localhost:8123/callback"] }, model: "oauthClient" }));
		yield* Effect.promise(() =>
			adapter.create({
				data: { clientId, createdAt: now, scopes: ["mcp"], updatedAt: now, userId: person(engine, name).id },
				model: "oauthConsent",
			}),
		);
		engine.clientIds.set(client, clientId);
		engine.tokens.set(client, yield* TOKENS[kind](engine, name, client));
	});
}

export const jwksUnavailable = mcp.trait("tokens", "the JWKS service is unavailable", (engine) =>
	Effect.sync(() => {
		engine.jwks.state.failure = "unavailable";
	}),
);

export const jwksUnreachable = mcp.trait("tokens", "the JWKS endpoint drops connections", (engine) =>
	Effect.sync(() => {
		engine.jwks.state.failure = "unreachable";
	}),
);

function connected(name: string) {
	return mcp.trait("connections", `${name}'s client is connected with that token`, function* (engine) {
		const outcome = yield* connects(engine, name);
		if (outcome !== "connected") {
			return yield* Effect.die(new Error(`${name}'s client could not connect: ${outcome}`));
		}
	});
}

export function connectedAs(name: string, role: "admin" | "user") {
	return mcp.traits(signedIn(name, role), holdsToken(name), connected(name));
}
