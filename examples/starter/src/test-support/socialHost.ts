import { once } from "node:events";
import { createServer } from "node:http";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { Effect, type Redacted } from "effect";
import { authDatabase } from "#server/authDatabase.ts";

export const socialHost = Effect.fn("SocialStory.socialHost")(function* (databaseUrl: Redacted.Redacted<string>) {
	const pool = yield* authDatabase(databaseUrl);
	const auth = betterAuth({
		advanced: { useSecureCookies: false },
		"baseURL": { allowedHosts: ["127.0.0.1:*"], protocol: "http" },
		database: pool,
		secret: "social-story-secret-with-at-least-32-characters",
		socialProviders: { github: { clientId: "story-client", clientSecret: "story-secret" } },
		trustedOrigins: ["http://127.0.0.1:*"],
	});
	yield* Effect.promise(async () => {
		await (await getMigrations(auth.options)).runMigrations();
	});
	const server = yield* Effect.acquireRelease(
		Effect.sync(() =>
			createServer(async (request, response) => {
				if (request.url?.startsWith("/api/auth/")) {
					await toNodeHandler(auth)(request, response);
					return;
				}
				const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
				response.setHeader("content-type", "text/html");
				response.end(`<main><h1>${session === null ? "Sign in" : `Signed in as ${session.user.email}`}</h1></main>`);
			}),
		),
		(listening) => Effect.promise(() => new Promise<void>((resolve, reject) => listening.close((error) => (error ? reject(error) : resolve())))),
	);
	yield* Effect.promise(async () => {
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die("Social story host needs a TCP address");
	}
	return { baseUrl: `http://127.0.0.1:${address.port}`, pool };
});
