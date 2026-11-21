import { expect } from "vitest";
import { APP_ORIGIN, appPaths } from "#test/authEmailHost.ts";
import { aliceAccount, approvalRequested, authEmails, production, queueUnavailable, resetCopy } from "#test/authEmails.ts";

for (const [kind, to, subject] of [
	["ConfirmAccount", "alice@example.test", "Confirm your account"],
	["ResetPassword", "alice@example.test", "Reset your password"],
	["ApproveEmailChange", "alice@example.test", "Approve your email change"],
	["ConfirmNewAddress", "alice-new@example.test", "Confirm your new email address"],
] as const) {
	const change = kind === "ApproveEmailChange" || kind === "ConfirmNewAddress";
	const traits = [aliceAccount(change), ...(kind === "ConfirmNewAddress" ? [approvalRequested] : [])];
	authEmails.it(
		`alice's ${kind} email reaches ${to} with its default subject and a link to ${appPaths[kind]} carrying the token`,
		traits,
		function* ({ nextEmail, request }) {
			yield* request(kind);

			expect(yield* nextEmail()).toMatchObject({ address: `${APP_ORIGIN}${appPaths[kind]}`, subject, to, token: true });
		},
	);
}

authEmails.it(
	"a sign-up for alice's existing address emails her the default sign-in subject and a link to /sign-in without a token",
	[aliceAccount(false)],
	function* ({ nextEmail, request }) {
		yield* request("AccountAlreadyExists");

		expect(yield* nextEmail()).toMatchObject({
			address: `${APP_ORIGIN}/sign-in`,
			subject: "Sign in to your account",
			to: "alice@example.test",
			token: false,
		});
	},
);

authEmails.it(
	"alice's confirmation email comes from the default sender and links the plain address in its text and the escaped address in its HTML",
	[aliceAccount(false)],
	function* ({ nextEmail, request }) {
		yield* request("ConfirmAccount");

		const { from, html, link, text } = yield* nextEmail();
		expect(from).toBe("Accounts <onboarding@resend.dev>");
		expect(link).toContain("&");
		expect(text).toContain(`Confirm your account: ${link}`);
		expect(html).toContain(`<a href="${link.replaceAll("&", "&amp;")}">Confirm your account</a>`);
	},
);

authEmails.it(
	"the app's reset copy replaces the reset subject and text while confirmation keeps its default subject",
	[resetCopy, aliceAccount(false)],
	function* ({ nextEmail, request }) {
		yield* request("ResetPassword");
		const reset = yield* nextEmail();
		yield* request("ConfirmAccount");
		const confirmation = yield* nextEmail();

		expect(reset).toMatchObject({ subject: "Reset your Example password", text: `Pick a new Example password.\n\nChoose a password: ${reset.link}` });
		expect(confirmation.subject).toBe("Confirm your account");
	},
);

authEmails.it(
	"alice's reset request is refused with EMAIL_UNAVAILABLE when the queue refuses its job",
	[aliceAccount(false), queueUnavailable],
	function* ({ request }) {
		expect(yield* request("ResetPassword")).toBe("refused: EMAIL_UNAVAILABLE");
	},
);

authEmails.it(
	"a production host with auth emails and no PUBLIC_URL refuses to start with a configuration error naming it",
	[production()],
	function* ({ startup }) {
		expect(yield* startup()).toMatch(/^configuration failed: .*PUBLIC_URL/su);
	},
);

authEmails.it(
	"in production, alice's confirmation link starts with the configured PUBLIC_URL",
	[production("https://accounts.example.test"), aliceAccount(false)],
	function* ({ nextEmail, request }) {
		yield* request("ConfirmAccount");

		expect((yield* nextEmail()).address).toBe("https://accounts.example.test/auth/confirm");
	},
);
