import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { emailLinks, unverifiedAlice } from "#test/better-auth/emailLinks.ts";

emailLinks.it(
	"alice's emailed verification link redirects to its callback with an empty body behind bearer sessions",
	[unverifiedAlice],
	function* ({ followEmail, requestEmail }) {
		const callback = "/email-confirmed?from=email";
		yield* requestEmail("verification", callback);

		const response = yield* followEmail("verification");

		expect(response).toEqual({ body: "", location: callback, status: HttpStatus.fromLiteral("Found") });
	},
);

emailLinks.it(
	"alice's emailed reset link redirects to its callback with the reset token and an empty body behind bearer sessions",
	[unverifiedAlice],
	function* ({ followEmail, requestEmail }) {
		yield* requestEmail("reset", "http://localhost:3000/new-password?from=email");

		const response = yield* followEmail("reset");

		expect(response).toEqual({
			body: "",
			location: expect.stringMatching(/^http:\/\/localhost:3000\/new-password\?from=email&token=[^&]+$/u),
			status: HttpStatus.fromLiteral("Found"),
		});
	},
);
