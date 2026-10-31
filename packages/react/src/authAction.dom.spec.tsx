import { expect } from "vitest";
import { authAttempt, authStories } from "#test/authStories.tsx";

for (const mode of ["atom", "Effect form"] as const) {
	for (const [attempt, code] of [
		["wrong password", "INVALID_EMAIL_OR_PASSWORD"],
		["rate limited", "RATE_LIMITED"],
		["unknown code", "UNKNOWN"],
		["missing code", "UNKNOWN"],
		["offline", "UNKNOWN"],
		["invalid email", "INVALID_EMAIL"],
	] as const) {
		authStories.it(`shows ${code} for a ${attempt} attempt through the ${mode}`, [authAttempt(mode, attempt)], function* ({ submit, shown }) {
			yield* submit();

			expect(shown()).toBe(code);
		});
	}
	authStories.it(`shows the successful sign-in through the ${mode}`, [authAttempt(mode, "success")], function* ({ submit, shown }) {
		yield* submit();

		expect(shown()).toBe("Signed in as alice@example.com");
	});
	authStories.it(
		`retains the transport rejection as the failure cause through the ${mode}`,
		[authAttempt(mode, "offline")],
		function* ({ submit, failureCause }) {
			yield* submit();

			expect(failureCause()).toMatchObject({ message: "Connection refused" });
		},
	);
	authStories.it(
		`retains an unsupported provider error as the failure cause through the ${mode}`,
		[authAttempt(mode, "unknown code")],
		function* ({ submit, failureCause }) {
			yield* submit();

			expect(failureCause()).toEqual({ code: "FUTURE_PROVIDER_ERROR" });
		},
	);
}
