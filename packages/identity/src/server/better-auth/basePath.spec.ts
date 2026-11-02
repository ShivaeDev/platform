import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceWithPassword, configuredPath, previousSession, routes, unverifiedAlice } from "#test/better-auth/routes.ts";

for (const [label, configured, path] of [
	["the default path", undefined, "/api/auth"],
	["a custom path", "/identity", "/identity"],
	["a path without a leading slash", "identity", "/identity"],
	["a nested custom path", "/app/identity", "/app/identity"],
	["a trailing slash", "/identity/", "/identity"],
	["the root path", "/", ""],
] as const) {
	routes.it(
		`with ${label}, alice signs in and reads her session with role permissions over HTTP`,
		[configuredPath(configured), aliceWithPassword],
		function* ({ session, signIn }) {
			const status = yield* signIn(path, "alice");
			expect(status).toBe(HttpStatus.fromLiteral("OK"));

			const answer = yield* session(path, "alice");

			expect(answer).toMatchObject({
				body: { user: { name: "alice", permissions: [{ name: "tools.use", strength: "own" }], role: "operator" } },
				status: HttpStatus.fromLiteral("OK"),
			});
		},
	);
}

routes.it(
	"under a custom path, alice's native sign-in replaces her previous bearer session",
	[configuredPath("/app/identity"), aliceWithPassword, previousSession],
	function* ({ session, signIn }) {
		const before = yield* session("/app/identity", "previous");
		expect(before).toMatchObject({ body: { user: { name: "alice" } }, status: HttpStatus.fromLiteral("OK") });

		const status = yield* signIn("/app/identity", "replacement", "previous");
		expect(status).toBe(HttpStatus.fromLiteral("OK"));

		yield* outcomes([
			["previous session", () => session("/app/identity", "previous"), { body: null, status: HttpStatus.fromLiteral("OK") }],
			[
				"replacement session",
				() => session("/app/identity", "replacement"),
				{ body: { user: { name: "alice" } }, status: HttpStatus.fromLiteral("OK") },
			],
		]);
	},
);

routes.it(
	"under a custom path, alice receives a verification URL at that path and follows it to her callback",
	[configuredPath("/app/identity"), unverifiedAlice],
	function* ({ emailedUrl, followEmail, requestEmail }) {
		const status = yield* requestEmail("/app/identity");

		yield* outcomes([
			["email request", () => Effect.succeed(status), HttpStatus.fromLiteral("OK")],
			["verification URL", () => emailedUrl().pipe(Effect.map((url) => new URL(url ?? "").pathname)), "/app/identity/verify-email"],
		]);

		const answer = yield* followEmail();

		expect(answer).toEqual({ location: "/verified", status: HttpStatus.fromLiteral("Found") });
	},
);
