import { expect } from "vitest";
import { screens as signInApp } from "#modules/notes/test-support/screens.ts";
import { signInVisitor } from "#modules/notes/test-support/signInVisitor.tsx";

const SIGNED_TARGET =
	"/resume?resume=%2Foauth%2Fconsent%3Fscope%3Da%2520b&scope=a%20b&lower=%2f&repeat=first&repeat=last&empty&code=123&state=%22signed%22&signature=a%2Bb%2Fc%3D";
for (const [path, moduleLink] of [
	[SIGNED_TARGET, false],
	["/resume?tab=history", true],
] as const) {
	signInApp.it(
		`returns to ${path} after signing in${moduleLink ? " from a module link" : " through a signed-in guard"}`,
		[signInVisitor(path, false, moduleLink)],
		function* ({ settle, heading, href, followLink, enter, submit, click }) {
			if (moduleLink) {
				yield* settle();
				expect(heading()).toBe("Your app");
				yield* followLink("Sign in");
			}
			yield* settle();
			expect(heading()).toBe("Sign in");
			expect(new URL(href(), "http://app.test").searchParams.get("returnTo")).toBe(path);
			yield* enter("alice@app.test", "Email");
			yield* enter("password123", "Password");
			yield* submit();
			yield* settle();
			expect(heading()).toBe("Your app");
			expect(href()).toBe(path);
			yield* click("Sign out");
			yield* settle();
			expect(heading()).toBe("Sign in");
			expect(href()).toBe("/sign-in");
		},
	);
}

signInApp.it(
	"an explicit sign-out forgets the protected deep link across session refresh",
	[signInVisitor(SIGNED_TARGET, true)],
	function* ({ settle, heading, click, href, authRequests }) {
		yield* settle();
		expect(heading()).toBe("Your app");
		yield* click("Sign out");
		yield* settle();
		expect(heading()).toBe("Sign in");
		expect(
			authRequests()
				.map((url) => url.pathname)
				.filter((path) => path === "/api/auth/get-session").length,
		).toBeGreaterThanOrEqual(2);
		expect(href()).toBe("/sign-in");
	},
);

for (const target of ["https://elsewhere.test/resume", "//elsewhere.test/resume", "/\\elsewhere.test/resume", "javascript:alert(1)"]) {
	signInApp.it(
		`refuses the external return target ${target}`,
		[signInVisitor(`/sign-in?returnTo=${encodeURIComponent(target)}`)],
		function* ({ settle, heading, enter, submit, href }) {
			yield* settle();
			expect(heading()).toBe("Sign in");
			yield* enter("alice@app.test", "Email");
			yield* enter("password123", "Password");
			yield* submit();
			yield* settle();
			expect(heading()).toBe("Notes");
			expect(href()).toBe("/");
		},
	);
}

signInApp.it(
	"a signed-in-only route returns to the note and its query after sign-in",
	[signInVisitor("/notes/1?tab=history")],
	function* ({ settle, heading, enter, submit, href, draft }) {
		yield* settle();
		expect(heading()).toBe("Sign in");
		expect(new URL(href(), "http://app.test").searchParams.get("returnTo")).toBe("/notes/1?tab=history");
		yield* enter("alice@app.test", "Email");
		yield* enter("password123", "Password");
		yield* submit();
		yield* settle();
		expect(draft()).toBe("Deep note");
		expect(href()).toBe("/notes/1?tab=history");
	},
);

signInApp.it(
	"a refused save rechecks the still-signed-in session once",
	[signInVisitor("/", true)],
	function* ({ settle, heading, expireSession, enter, submit, alert, authRequests }) {
		yield* settle();
		expect(heading()).toBe("Notes");
		yield* expireSession();
		yield* enter("Retain this draft");
		yield* submit();
		yield* settle();
		expect(alert()).toBe("Sign in to add a note.");
		expect(
			authRequests()
				.map((url) => url.pathname)
				.filter((path) => path === "/api/auth/get-session"),
		).toEqual(["/api/auth/get-session", "/api/auth/get-session"]);
		yield* enter("A newer draft");
		expect(
			authRequests()
				.map((url) => url.pathname)
				.filter((path) => path === "/api/auth/get-session"),
		).toEqual(["/api/auth/get-session", "/api/auth/get-session"]);
	},
);
