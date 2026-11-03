import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { AuthFailure } from "#client/AuthFailure.ts";
import { emailChanges } from "#test/better-auth/emailChanges.ts";

emailChanges.it(
	"alice's current password requests approval, and her emailed link redirects with an empty body",
	[],
	function* ({ approvalMessages, changeEmail, followApprovalLink }) {
		const response = yield* changeEmail();

		expect(response).toEqual({ status: true });
		expect(yield* approvalMessages()).toMatchObject([
			{ _tag: "ApproveEmailChange", newEmail: "alice-new@example.test", user: { email: "alice@example.test" } },
		]);

		const approval = yield* followApprovalLink();

		expect(approval).toEqual({ body: "", location: "/email-changed", status: HttpStatus.fromLiteral("Found") });
	},
);

emailChanges.it("alice's wrong password fails as typed INVALID_PASSWORD and sends no approval", [], function* ({ approvalMessages, changeEmail }) {
	const failure = yield* Effect.flip(changeEmail("wrong-password"));

	expect(failure).toBeInstanceOf(AuthFailure);
	expect(failure.code).toBe("INVALID_PASSWORD");
	expect(yield* approvalMessages()).toEqual([]);
});
