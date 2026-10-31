import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { cookieOnly, type ForgedBearer, nativeSessions, nativeTransport, passwordAccount, signedIn } from "#test/native-sessions/story.ts";

const alice = signedIn("alice");
const both = signedIn("alice", "bob");
const WEB_VIEW = "capacitor://localhost";
const UNAUTHORIZED = "failed with unauthorized";
const mixed = { bearer: "alice", cookie: "bob" };

nativeSessions.it("Alice's bearer reads her linked GitHub account", [alice], function* ({ providerAccounts }) {
	expect(yield* providerAccounts({ bearer: "alice" })).toEqual([{ accountId: "alice-github", providerId: "github" }]);
});

nativeSessions.it("with Alice's bearer and Bob's cookie, the provider-account read belongs to Bob", [both], function* ({ providerAccounts }) {
	expect(yield* providerAccounts(mixed)).toEqual([{ accountId: "bob-github", providerId: "github" }]);
});

nativeSessions.it("a revoked Bob cookie cannot use Alice's bearer to read provider accounts", [both], function* ({ providerAccounts, signsOut }) {
	expect(yield* providerAccounts(mixed)).toEqual([{ accountId: "bob-github", providerId: "github" }]);

	yield* signsOut(mixed);

	expect(yield* providerAccounts(mixed)).toBe(UNAUTHORIZED);
});

nativeSessions.it(
	"Alice's native sign-in issues a signed bearer credential exposed to the WebView",
	[nativeTransport, passwordAccount("alice")],
	function* ({ exposedHeaders, issuedCredential, signIn }) {
		yield* signIn("alice");

		yield* outcomes({
			credential: [issuedCredential("alice"), "signed"],
			"exposed headers": [exposedHeaders("alice"), expect.stringContaining("set-auth-token")],
		});
	},
);

nativeSessions.it(
	"the WebView's bearer reaches Alice's session through the auth route and her profile through RPC",
	[nativeTransport, alice],
	function* ({ profile, sessionUser }) {
		yield* outcomes({
			profile: [profile({ bearer: "alice", origin: WEB_VIEW }, "alice"), "alice's profile"],
			session: [sessionUser({ bearer: "alice", origin: WEB_VIEW }), "alice"],
		});
	},
);

nativeSessions.it("Alice's and Bob's bearers each read their own profile", [both], function* ({ profile }) {
	yield* outcomes({
		alice: [profile({ bearer: "alice" }, "alice"), "alice's profile"],
		bob: [profile({ bearer: "bob" }, "bob"), "bob's profile"],
	});
});

nativeSessions.it("Alice's bearer is forbidden from Bob's profile", [both], function* ({ profile }) {
	expect(yield* profile({ bearer: "alice" }, "bob")).toBe("failed with forbidden");
});

nativeSessions.it("with Alice's bearer and Bob's cookie, the auth route and RPC both act as Bob", [both], function* ({ profile, sessionUser }) {
	yield* outcomes({
		profile: [profile(mixed, "bob"), "bob's profile"],
		session: [sessionUser(mixed), "bob"],
	});
});

nativeSessions.it("signing out with Alice's bearer and Bob's cookie ends Bob's session and keeps Alice's", [both], function* ({ profile, signsOut }) {
	expect(yield* profile(mixed, "bob")).toBe("bob's profile");

	yield* signsOut(mixed);

	yield* outcomes({
		"Alice's bearer": [profile({ bearer: "alice" }, "alice"), "alice's profile"],
		"Bob's cookie": [profile(mixed, "bob"), UNAUTHORIZED],
	});
});

nativeSessions.it(
	"Alice's browser sign-in sets an HttpOnly session cookie and exposes no bearer credential or token",
	[passwordAccount("alice")],
	function* ({ browserSignsIn }) {
		expect(yield* browserSignsIn("alice")).toEqual({
			bearerCredential: "none",
			cookie: "HttpOnly session cookie",
			exposedHeaders: "no auth token",
			responseToken: "none",
		});
	},
);

nativeSessions.it(
	"Alice's browser cookie reads her profile while the session route returns neither a token nor a bearer credential",
	[passwordAccount("alice")],
	function* ({ browserSignsIn, profile, sessionTokens }) {
		yield* browserSignsIn("alice");

		yield* outcomes({
			profile: [profile({ cookie: "alice in the browser" }, "alice"), "alice's profile"],
			session: [sessionTokens({ cookie: "alice in the browser" }), { bearerCredential: "none", sessionToken: "none" }],
		});
	},
);

for (const kind of ["missing", "unsigned", "prefixed", "tampered", "malformed", "invented"] satisfies ForgedBearer[]) {
	nativeSessions.it(`a ${kind} bearer fails the profile RPC as unauthorized and finds no session`, [alice], function* ({ profile, sessionUser }) {
		yield* outcomes({
			profile: [profile({ forged: [kind, "alice"] }, "alice"), UNAUTHORIZED],
			session: [sessionUser({ forged: [kind, "alice"] }), "no session"],
		});
	});
}

nativeSessions.it(
	"after Alice's session expires, her bearer fails the profile RPC as unauthorized and finds no session",
	[alice],
	function* ({ profile, sessionExpires, sessionUser }) {
		expect(yield* profile({ bearer: "alice" }, "alice")).toBe("alice's profile");

		yield* sessionExpires();

		yield* outcomes({
			profile: [profile({ bearer: "alice" }, "alice"), UNAUTHORIZED],
			session: [sessionUser({ bearer: "alice" }), "no session"],
		});
	},
);

nativeSessions.it(
	"signing out revokes Alice's bearer and ends her open socket subscription as unauthorized",
	[alice],
	function* ({ profile, signsOut, subscribes, subscriptionEnding }) {
		yield* subscribes("alice");

		yield* signsOut({ bearer: "alice" });

		yield* outcomes({
			profile: [profile({ bearer: "alice" }, "alice"), UNAUTHORIZED],
			subscription: [subscriptionEnding(), UNAUTHORIZED],
		});
	},
);

nativeSessions.it(
	"signing in again revokes Alice's old bearer and subscription while the replacement bearer reads her profile",
	[passwordAccount("alice")],
	function* ({ profile, signsInAgain, subscribes, subscriptionEnding }) {
		yield* subscribes("alice");

		yield* signsInAgain("alice");

		yield* outcomes({
			"old bearer": [profile({ bearer: "alice" }, "alice"), UNAUTHORIZED],
			"replacement bearer": [profile({ bearer: "alice's replacement" }, "alice"), "alice's profile"],
			subscription: [subscriptionEnding(), UNAUTHORIZED],
		});
	},
);

nativeSessions.it(
	"Alice's bearer reaches host logs and spans only as a redacted value",
	[alice],
	function* ({ credentialLeaks, diagnosticMentions, hostStops, recordDiagnostics }) {
		yield* recordDiagnostics("alice");
		yield* hostStops();

		yield* outcomes({
			"encoded redaction": [diagnosticMentions('"encoded":"Bearer <redacted>"'), ["logs"]],
			leaks: [credentialLeaks("alice"), []],
			"redacted bearer": [diagnosticMentions("Bearer <redacted>"), ["logs", "spans"]],
		});
	},
);

nativeSessions.it("the default host issues Alice no bearer credential", [cookieOnly, alice], function* ({ issuedCredential }) {
	expect(yield* issuedCredential("alice")).toBe("none");
});

for (const [sent, caller] of [
	["session token", { tokenAsBearer: "alice" }],
	["session cookie value", { cookieValueAsBearer: "alice" }],
] as const) {
	nativeSessions.it(`the default host refuses Alice's ${sent} sent as a bearer`, [cookieOnly, alice], function* ({ profile }) {
		expect(yield* profile(caller, "alice")).toBe(UNAUTHORIZED);
	});
}

nativeSessions.it("the default host accepts Alice's cookie", [cookieOnly, alice], function* ({ profile }) {
	expect(yield* profile({ cookie: "alice" }, "alice")).toBe("alice's profile");
});
