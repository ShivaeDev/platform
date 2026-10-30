import { Effect } from "effect";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { connects } from "./client.ts";
import { type Engine, person } from "./host.ts";
import { mcp } from "./mcp.ts";

function sign(engine: Engine, payload: Record<string, string>) {
	return Effect.promise(async () => (await engine.auth.api.signJWT({ body: { payload } })).token);
}

function claims(engine: Engine, name: string) {
	return { aud: engine.resource, iss: `${engine.baseUrl}/api/auth`, scope: "mcp", sub: person(engine, name).id };
}

export const REFUSED_TOKENS = [
	"for another resource, https://other.test/mcp",
	"issued by https://other.test/api/auth",
	"that is not a JWT",
	"whose claims were altered after signing",
	"with the scope other instead of mcp",
] as const;
export type TokenKind = "for this endpoint" | (typeof REFUSED_TOKENS)[number];

const TOKENS: Record<TokenKind, (engine: Engine, name: string) => Effect.Effect<string>> = {
	"for another resource, https://other.test/mcp": (engine, name) => sign(engine, { ...claims(engine, name), aud: "https://other.test/mcp" }),
	"for this endpoint": (engine, name) => sign(engine, claims(engine, name)),
	"issued by https://other.test/api/auth": (engine, name) => sign(engine, { ...claims(engine, name), iss: "https://other.test/api/auth" }),
	"that is not a JWT": () => Effect.succeed("not-a-jwt"),
	"whose claims were altered after signing": (engine, name) =>
		Effect.map(sign(engine, claims(engine, name)), (token) => {
			const [header, , signature] = token.split(".");
			const altered = Buffer.from(JSON.stringify({ ...claims(engine, name), altered: true })).toString("base64url");
			return `${header}.${altered}.${signature}`;
		}),
	"with the scope other instead of mcp": (engine, name) => sign(engine, { ...claims(engine, name), scope: "other" }),
};

export function signedIn(name: string, role: "admin" | "user") {
	return mcp.trait("people", `${name} is signed in as ${role === "admin" ? "an admin" : "a user"}`, function* (engine) {
		const session = yield* Effect.promise(() => signedInUser(engine.auth, { email: `${name}@mcp.test`, name, role }));
		engine.people.set(name, { cookie: session.headers.get("cookie") ?? "", id: session.user.id });
	});
}

export function holdsToken(name: string, kind: TokenKind = "for this endpoint") {
	return mcp.trait("tokens", `${name}'s client holds an access token ${kind}`, function* (engine) {
		engine.tokens.set(name, yield* TOKENS[kind](engine, name));
	});
}

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
