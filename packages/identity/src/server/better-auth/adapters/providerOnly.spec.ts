import { expect } from "vitest";
import { adminListDisabled, adminListEnabled, emailEndpointEnabled, providerOnly, withoutPreset } from "#test/better-auth/providerOnly.ts";

const closedEndpoints = [
	["/sign-in/email", "POST"],
	["/sign-up/email", "POST"],
	["/request-password-reset", "POST"],
	["/reset-password", "POST"],
	["/change-password", "POST"],
	["/verify-password", "POST"],
	["/change-email", "POST"],
	["/send-verification-email", "POST"],
	["/verify-email", "GET"],
	["/sign-in/magic-link", "POST"],
	["/magic-link/verify", "GET"],
	["/admin/set-role", "POST"],
	["/admin/get-user", "GET"],
	["/admin/create-user", "POST"],
	["/admin/update-user", "POST"],
	["/admin/list-users", "GET"],
	["/admin/list-user-sessions", "POST"],
	["/admin/unban-user", "POST"],
	["/admin/ban-user", "POST"],
	["/admin/impersonate-user", "POST"],
	["/admin/stop-impersonating", "POST"],
	["/admin/revoke-user-session", "POST"],
	["/admin/revoke-user-sessions", "POST"],
	["/admin/remove-user", "POST"],
	["/admin/set-user-password", "POST"],
	["/admin/has-permission", "POST"],
] as const;

for (const [path, method] of closedEndpoints) {
	providerOnly.it(`the provider-only mount refuses ${method} ${path} even for an administrator`, [], function* ({ call }) {
		expect(yield* call(path, method)).toEqual({ body: "Not Found", status: 404 });
	});
}

providerOnly.it("an app can explicitly re-enable the admin user list", [adminListEnabled], function* ({ listUsers }) {
	expect(yield* listUsers()).toEqual({ names: ["alice"], status: 200 });
});

providerOnly.it(
	"an app's disabled path remains closed even when it is a preset exception",
	[adminListEnabled, adminListDisabled],
	function* ({ call }) {
		expect(yield* call("/admin/list-users", "GET")).toEqual({ body: "Not Found", status: 404 });
	},
);

providerOnly.it("the admin user list stays available when no preset is selected", [withoutPreset], function* ({ listUsers }) {
	expect(yield* listUsers()).toEqual({ names: ["alice"], status: 200 });
});

providerOnly.it("reopening the email endpoint still leaves password authentication disabled", [emailEndpointEnabled], function* ({ call }) {
	const answer = yield* call("/sign-in/email", "POST", { email: "alice@admin.test", password: "story-password" });

	expect(answer).toEqual({ body: { code: "EMAIL_PASSWORD_DISABLED", message: "Email and password is not enabled" }, status: 400 });
});

const credentials = [
	{ accountId: "123", hasAccessToken: false, hasIdToken: false, hasPassword: false, hasRefreshToken: false, providerId: "github" },
];

providerOnly.it("GitHub sign-in stores the provider account without access or refresh tokens", [], function* ({ signIn, storedProviderAccounts }) {
	yield* signIn();

	expect(yield* storedProviderAccounts()).toEqual(credentials);
});

providerOnly.it("a returning GitHub sign-in also leaves no stored provider tokens", [], function* ({ signIn, storedProviderAccounts }) {
	yield* signIn();

	yield* signIn();

	expect(yield* storedProviderAccounts()).toEqual(credentials);
});

providerOnly.it("GitHub account creates and updates still run the application's database hooks", [], function* ({ accountHookCalls, signIn }) {
	yield* signIn();
	yield* signIn();

	expect(yield* accountHookCalls()).toEqual(["create", "update"]);
});

providerOnly.it(
	"GitHub sign-in issues only the session token cookie, without session or account cache cookies",
	[],
	function* ({ browserCookieNames, signIn }) {
		yield* signIn();

		expect(yield* browserCookieNames()).toEqual(["better-auth.session_token"]);
	},
);

providerOnly.it(
	"after the stored session expires, GitHub's signed-in browser has no cached session",
	[],
	function* ({ expireSessions, session, signIn }) {
		yield* signIn();
		expect(yield* session()).toBe("Alice");

		yield* expireSessions();

		expect(yield* session()).toBe("signed out");
	},
);
