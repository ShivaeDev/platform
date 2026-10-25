import { expect } from "vitest";
import { cookieOnly, nativeSessions, signedIn } from "#test/native-sessions/story.ts";

const alice = signedIn("alice");
const both = signedIn("alice", "bob");
const unauthorized = { _tag: "Failure", failure: { _tag: "Unauthorized", message: "Authentication required" } };

nativeSessions.it(
	"native sign-in issues a signed credential accepted by auth and request-local profile RPC",
	[alice],
	function* ({ account, bearer, getSession, profile }) {
		const session = account("alice");
		expect(session.credential).toEqual(expect.stringContaining("."));
		expect(session.exposed).toContain("set-auth-token");
		expect(yield* getSession(bearer("alice"))).toMatchObject({ body: { user: session.user }, status: 200 });
		expect(yield* profile("alice")).toMatchObject({
			_tag: "Success",
			success: { email: session.user.email, id: session.user.id, name: session.user.name, role: "user" },
		});
	},
);

nativeSessions.it("two bearer accounts stay isolated", [both], function* ({ account, profile }) {
	expect(yield* profile("alice")).toMatchObject({ _tag: "Success", success: { id: account("alice").user.id } });
	expect(yield* profile("bob")).toMatchObject({ _tag: "Success", success: { id: account("bob").user.id } });
	expect(yield* profile("bob", undefined, "alice")).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
});

nativeSessions.it(
	"cookies win on auth and RPC even when another account supplies a bearer",
	[both],
	function* ({ account, bearer, getSession, profile, signout }) {
		const headers = { ...bearer("alice"), cookie: account("bob").cookie };
		expect(yield* getSession(headers)).toMatchObject({ body: { user: account("bob").user } });
		expect(yield* profile("bob", headers)).toMatchObject({ _tag: "Success", success: { id: account("bob").user.id } });
		const status = yield* signout("bob", headers);
		expect(status).toBe(200);
		expect(yield* profile("bob", headers)).toMatchObject(unauthorized);
		expect(yield* profile("alice")).toMatchObject({ _tag: "Success" });
	},
);

nativeSessions.it(
	"browser sign-in keeps HttpOnly cookies without exposing either token response",
	[alice],
	function* ({ browserLogin, getSession, profile }) {
		const browser = yield* browserLogin("alice");
		expect(browser.credential).toBeNull();
		expect(browser.httpOnly).toBe(true);
		expect(browser.exposed ?? "").not.toContain("set-auth-token");
		expect(browser.token).toBeUndefined();
		expect(browser.cookie).toContain("better-auth.session_token=");
		expect(yield* profile("alice", { cookie: browser.cookie })).toMatchObject({ _tag: "Success" });
		const session = yield* getSession({ cookie: browser.cookie });
		expect(session).toMatchObject({ body: { session: expect.not.objectContaining({ token: expect.any(String) }) }, credential: null });
	},
);

nativeSessions.it(
	"missing, unsigned, tampered and malformed bearers fail typed without a cookie fallback",
	[alice],
	function* ({ account, getSession, profile }) {
		const credential = account("alice").credential ?? "";
		const unsigned = credential.split(".")[0] ?? "";
		for (const authorization of [
			"",
			`Bearer ${unsigned}`,
			`Bearer x${credential}`,
			`Bearer ${credential.split(".")[0]}.tampered`,
			"Bearer %broken",
			"Bearer invalid.signature",
		]) {
			expect(yield* profile("alice", { authorization })).toMatchObject(unauthorized);
			expect(yield* getSession({ authorization })).toMatchObject({ body: null, status: 200 });
		}
	},
);

nativeSessions.it("expired bearer sessions fail typed", [alice], function* ({ expire, profile, bearer, getSession }) {
	yield* expire();
	expect(yield* profile("alice")).toMatchObject(unauthorized);
	expect(yield* getSession(bearer("alice"))).toMatchObject({ body: null, status: 200 });
});

nativeSessions.it("sign-out revokes the bearer and ends its open NDJSON change subscription", [alice], function* ({ subscribe, signout, profile }) {
	const subscription = yield* subscribe("alice");
	yield* subscription.next;
	const status = yield* signout("alice");
	expect(status).toBe(200);
	expect(yield* subscription.ended).toMatchObject(unauthorized);
	expect(yield* profile("alice")).toMatchObject(unauthorized);
});

nativeSessions.it("replacing a bearer session revokes the old credential and subscription", [alice], function* ({ subscribe, replace, profile }) {
	const subscription = yield* subscribe("alice");
	yield* subscription.next;
	const replacement = yield* replace("alice");
	expect(yield* subscription.ended).toMatchObject(unauthorized);
	expect(yield* profile("alice")).toMatchObject(unauthorized);
	expect(yield* profile("alice", { authorization: `Bearer ${replacement.credential}` })).toMatchObject({ _tag: "Success" });
});

nativeSessions.it("bearer credentials stay out of host logs and spans", [alice], function* ({ account, diagnostics, recordDiagnostics, stopHost }) {
	yield* recordDiagnostics("alice");
	yield* stopHost();
	const result = diagnostics();
	expect(result.logs).toContain('"encoded":"Bearer <redacted>"');
	for (const output of [result.logs, result.spans]) {
		expect(output).toContain("Bearer <redacted>");
		expect(output).not.toContain(account("alice").credential);
		expect(output).not.toContain(encodeURIComponent(account("alice").credential ?? ""));
		expect(output).not.toContain(account("alice").token);
	}
});

nativeSessions.it("the default host refuses bearer sessions while accepting cookies", [cookieOnly, alice], function* ({ account, profile }) {
	const session = account("alice");
	expect(session.credential).toBeNull();
	expect(yield* profile("alice", { authorization: `Bearer ${session.token}` })).toMatchObject(unauthorized);
	expect(yield* profile("alice", { authorization: `Bearer ${session.cookie.split("=")[1]}` })).toMatchObject(unauthorized);
	expect(yield* profile("alice", { cookie: session.cookie })).toMatchObject({ _tag: "Success" });
});
