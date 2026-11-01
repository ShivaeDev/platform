import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { bobAccount, bobResetEmail, passwordResets, waitingReset } from "#test/better-auth/passwordReset.ts";

passwordResets.it(
	"bob's reset runs the native callback before the application Effect using bob's request service",
	[bobAccount, bobResetEmail],
	function* ({ recordedResetHooks, resetPassword }) {
		expect(yield* recordedResetHooks()).toEqual([]);

		const response = yield* resetPassword("bob");

		yield* outcomes([
			["reset response", () => Effect.succeed(response), { status: 200 }],
			["recorded reset hooks", () => recordedResetHooks(), ["native bob", "effect bob"]],
		]);
	},
);

passwordResets.it(
	"a reset Effect's typed failure from the request service reaches the HTTP caller",
	[bobAccount, bobResetEmail],
	function* ({ resetPassword }) {
		const response = yield* resetPassword("bob", "alice");

		expect(response).toEqual({ code: "MEMBERS_ONLY", message: "Membership is required", status: 403 });
	},
);

passwordResets.it("a direct reset runs the application Effect with the mount's service", [bobAccount, bobResetEmail], function* ({ resetPassword }) {
	const response = yield* resetPassword("bob", "bob", true);

	expect(response).toEqual({ code: "MEMBERS_ONLY", message: "Membership is required", status: 403 });
});

passwordResets.it(
	"cancelling a reset interrupts the application's waiting Effect",
	[bobAccount, bobResetEmail, waitingReset],
	function* ({ cancelReset, hookInterrupted }) {
		yield* cancelReset("bob");

		expect(yield* hookInterrupted()).toBe("interrupted");
	},
);
