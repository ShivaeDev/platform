import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { signInLimits } from "#test/better-auth/signInLimits.ts";

signInLimits.it("alice's sign-ins on two PostgreSQL hosts consume one budget while bob keeps his own", [], function* ({ signIn }) {
	yield* outcomes([
		["alice's first attempt", () => signIn("first"), { status: HttpStatus.fromLiteral("Unauthorized") }],
		["alice's second attempt", () => signIn("second"), { status: HttpStatus.fromLiteral("Unauthorized") }],
	]);

	yield* outcomes([
		[
			"alice on the first host",
			() => signIn("first"),
			{ retryAfter: expect.stringMatching(/^\d+$/u), status: HttpStatus.fromLiteral("TooManyRequests") },
		],
		["alice on the second host", () => signIn("second"), { status: HttpStatus.fromLiteral("TooManyRequests") }],
		["bob on the second host", () => signIn("second", "bob"), { status: HttpStatus.fromLiteral("Unauthorized") }],
	]);
});

signInLimits.it("a sign-in is unavailable when the host's PostgreSQL rate-limit store fails", [], function* ({ signIn, storageUnavailable }) {
	expect((yield* signIn("first")).status).toBe(HttpStatus.fromLiteral("Unauthorized"));

	yield* storageUnavailable();

	expect((yield* signIn("second")).status).toBe(HttpStatus.fromLiteral("ServiceUnavailable"));
});
