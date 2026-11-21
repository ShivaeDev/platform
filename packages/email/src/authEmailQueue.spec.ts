import { expect } from "vitest";
import { APP_ORIGIN, appPaths } from "#test/authEmailHost.ts";
import { aliceAccount, approvalRequested, authEmails, brandedLayout, production, queueUnavailable, resetCopy } from "#test/authEmails.ts";

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
	"without a layout, alice's confirmation email comes from the default sender with the plain link in its text and HTML made of its paragraphs, the escaped link and its footer",
	[aliceAccount(false)],
	function* ({ nextEmail, request }) {
		yield* request("ConfirmAccount");

		const { from, html, link, text } = yield* nextEmail();
		expect(from).toBe("Accounts <onboarding@resend.dev>");
		expect(link).toContain("&");
		expect(text).toBe(
			`Confirm this email address to finish setting up your account.\n\nConfirm your account: ${link}\n\nIf you did not create an account, you can ignore this email.`,
		);
		expect(html).toBe(
			[
				"<p>Confirm this email address to finish setting up your account.</p>",
				`<p><a href="${link.replaceAll("&", "&amp;")}">Confirm your account</a></p>`,
				"<p>If you did not create an account, you can ignore this email.</p>",
			].join("\n"),
		);
	},
);

authEmails.it(
	"the app's layout wraps alice's confirmation in its header and button with the subject, copy line, label and link escaped except for apostrophes, the absent footer left out and the text body plain",
	[brandedLayout, aliceAccount(false)],
	function* ({ nextEmail, request }) {
		yield* request("ConfirmAccount");

		const { html, link, subject, text } = yield* nextEmail();
		expect(subject).toBe("Confirm <your> Example account");
		expect(text).toBe(`Welcome, <b>Alice</b> & Bob's friends.\n\nSay "Confirm": ${link}`);
		expect(html).toBe(
			[
				"<html><head><title>Confirm &lt;your&gt; Example account</title></head><body>",
				'<header style="color: #b45309">Example</header>',
				"<p>Welcome, &lt;b&gt;Alice&lt;/b&gt; &amp; Bob's friends.</p>",
				`<a class="button" style="background: #b45309" href="${link.replaceAll("&", "&amp;")}">Say &quot;Confirm&quot;</a>`,
				"<footer>No footer</footer>",
				"</body></html>",
			].join(""),
		);
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
