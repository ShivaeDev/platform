import { expect } from "vitest";
import { aliceAccount, emailContinuations } from "#test/better-auth/emailContinuations.ts";

emailContinuations.it("alice's sign-up email continues to the invitation page after verification", [], function* ({ request, followEmail }) {
	yield* request("sign-up/email", "/invite?code=team%2Fone", { name: "alice", password: "alice-signup-password" });

	const page = yield* followEmail("ConfirmAccount");

	expect(page).toEqual({ body: "Continue to the invitation", page: "/invite?code=team%2Fone", status: 200 });
});

emailContinuations.it(
	"alice's sign-up email omits an off-origin continuation even when auth trusts that origin",
	[],
	function* ({ request, deliveredLink }) {
		yield* request("sign-up/email", "https://other.example.test/invite", { name: "alice", password: "alice-signup-password" });

		expect(yield* deliveredLink("ConfirmAccount")).toMatchObject({ callback: null, from: "email" });
	},
);

for (const [path, kind, body] of [
	["send-verification-email", "ConfirmAccount", {}],
	["request-password-reset", "ResetPassword", {}],
	["change-email", "ApproveEmailChange", { newEmail: "alice-new@example.test" }],
	["sign-up/email", "AccountAlreadyExists", { name: "alice", password: "alice-signup-password" }],
] as const) {
	const account = aliceAccount(kind === "ApproveEmailChange");
	emailContinuations.it(`${kind} preserves a relative continuation and the app route query`, [account], function* ({ request, deliveredLink }) {
		yield* request(path, "/invite?code=team%2Fone#accept", body);

		expect(yield* deliveredLink(kind)).toMatchObject({ callback: "/invite?code=team%2Fone#accept", from: "email" });
	});
	emailContinuations.it(
		`${kind} omits a continuation on the separate auth origin`,
		[account],
		function* ({ request, deliveredLink, authenticationOrigin }) {
			const callback = `${yield* authenticationOrigin()}/invite`;

			yield* request(path, callback, body);

			expect(yield* deliveredLink(kind)).toMatchObject({ callback: null, from: "email" });
		},
	);
	emailContinuations.it(
		`${kind} preserves an absolute continuation on the app origin`,
		[account],
		function* ({ request, deliveredLink, applicationOrigin }) {
			const callback = `${yield* applicationOrigin()}/invite?code=team%2Fone#accept`;

			yield* request(path, callback, body);

			expect(yield* deliveredLink(kind)).toMatchObject({ callback, from: "email" });
		},
	);

	for (const callback of ["https://other.example.test/invite", "//other.example.test/invite", "javascript:alert(1)"]) {
		emailContinuations.it(`${kind} omits the off-origin continuation ${callback}`, [account], function* ({ request, deliveredLink }) {
			yield* request(path, callback, body);

			expect(yield* deliveredLink(kind)).toMatchObject({ callback: null, from: "email" });
		});
	}
}

emailContinuations.it(
	"the new-address confirmation retains the approval's continuation",
	[aliceAccount(true)],
	function* ({ request, followEmail, deliveredLink }) {
		yield* request("change-email", "/invite?code=team%2Fone", { newEmail: "alice-new@example.test" });

		yield* followEmail("ApproveEmailChange");

		expect(yield* deliveredLink("ConfirmNewAddress")).toMatchObject({ callback: "/invite?code=team%2Fone", from: "email" });
	},
);
