import { expect } from "@effect/vitest";
import * as HttpStatus from "effect/http/HttpStatus";
import { oauthConsumer } from "#test/oauthConsumer.ts";

for (const basic of [false, true]) {
	oauthConsumer.it(
		`a ${basic ? "Basic" : "POST"}-authenticated code exchange grants access to Carol's profile and preserves state`,
		[],
		function* ({ authorize, exchange, profile }) {
			const redirect = yield* authorize();
			expect(redirect).toEqual({ error: null, state: "client-state", status: 302 });

			const grant = yield* exchange({}, basic);
			expect(grant).toEqual({ error: null, status: 200 });

			const details = yield* profile();
			expect(details).toEqual({
				body: { email: "carol@example.test", "email_verified": false, name: "Carol", sub: "carol-id" },
				status: 200,
			});
		},
	);
}

oauthConsumer.it("a code cannot be exchanged twice", [], function* ({ authorize, exchange }) {
	yield* authorize();
	const grant = yield* exchange();
	expect(grant).toEqual({ error: null, status: 200 });

	const refusal = yield* exchange();
	expect(refusal).toEqual({ error: "invalid_grant", status: 400 });
});

for (const [name, fields, error, status] of [
	["wrong client", { "client_id": "another-client" }, "invalid_client", 401],
	["wrong secret", { "client_secret": "another-secret" }, "invalid_client", 401],
	["wrong redirect", { "redirect_uri": "http://another.test/callback" }, "invalid_grant", 400],
	["wrong verifier", { "code_verifier": "another-verifier" }, "invalid_grant", 400],
	["unknown code", { code: "unknown-code" }, "invalid_grant", 400],
] as const) {
	oauthConsumer.it(`an exchange with the ${name} refuses the grant`, [], function* ({ authorize, exchange }) {
		yield* authorize();

		expect(yield* exchange(fields)).toEqual({ error, status });
	});
}

oauthConsumer.it("a code expires at its configured thirty-second deadline", [], function* ({ authorize, codeLifetimePasses, exchange }) {
	yield* authorize();
	yield* codeLifetimePasses();

	const refusal = yield* exchange();
	expect(refusal).toEqual({ error: "invalid_grant", status: 400 });
});

oauthConsumer.it("an expired access token no longer grants profile access", [], function* ({ authorize, exchange, profile, tokenLifetimePasses }) {
	yield* authorize();
	yield* exchange();
	expect((yield* profile()).status).toBe(HttpStatus.fromLiteral("OK"));

	yield* tokenLifetimePasses();

	expect(yield* profile()).toEqual({ body: { error: "invalid_token" }, status: 401 });
});
