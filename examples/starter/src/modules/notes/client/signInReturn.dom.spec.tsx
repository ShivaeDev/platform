import { expect } from "vitest";
import { eventually } from "@shivaedev/react/client/testing.ts";
import { screens as signInApp } from "#modules/notes/test-support/screens.ts";
import { signInVisitor } from "#modules/notes/test-support/signInVisitor.tsx";

const SIGNED_TARGET =
	"/resume?resume=%2Foauth%2Fconsent%3Fscope%3Da%2520b&scope=a%20b&lower=%2f&repeat=first&repeat=last&empty&code=123&state=%22signed%22&signature=a%2Bb%2Fc%3D";
for (const [path, moduleLink] of [
	[SIGNED_TARGET, false],
	["/resume?tab=history", true],
] as const) {
	signInApp.it(
		`returns to ${path} after signing in${moduleLink ? " from a module link" : " through a permission guard"}`,
		[signInVisitor(path, false, moduleLink)],
		function* ({ heading, href, followLink, enter, submit, click }) {
			if (moduleLink) {
				yield* eventually(() => expect(heading()).toBe("Your app"));
				yield* followLink("Sign in");
			}
			yield* eventually(() => expect(heading()).toBe("Sign in"));
			expect(new URL(href(), "http://app.test").searchParams.get("returnTo")).toBe(path);
			yield* enter("alice@app.test", "Email");
			yield* enter("password123", "Password");
			yield* submit();
			yield* eventually(() => expect(heading()).toBe("Your app"));
			expect(href()).toBe(path);
			yield* click("Sign out");
			yield* eventually(() => expect(heading()).toBe("Sign in"));
			expect(href()).toBe("/sign-in");
		},
	);
}

signInApp.it(
	"an explicit sign-out forgets the protected deep link across session refresh",
	[signInVisitor(SIGNED_TARGET, true)],
	function* ({ heading, click, href, authRequests }) {
		yield* eventually(() => expect(heading()).toBe("Your app"));
		yield* click("Sign out");
		yield* eventually(() => expect(heading()).toBe("Sign in"));
		yield* eventually(() =>
			expect(
				authRequests()
					.map((url) => url.pathname)
					.filter((path) => path === "/api/auth/get-session").length,
			).toBeGreaterThanOrEqual(2),
		);
		expect(href()).toBe("/sign-in");
	},
);

for (const target of ["https://elsewhere.test/resume", "//elsewhere.test/resume", "/\\elsewhere.test/resume", "javascript:alert(1)"]) {
	signInApp.it(
		`refuses the external return target ${target}`,
		[signInVisitor(`/sign-in?returnTo=${encodeURIComponent(target)}`)],
		function* ({ heading, enter, submit, href }) {
			yield* eventually(() => expect(heading()).toBe("Sign in"));
			yield* enter("alice@app.test", "Email");
			yield* enter("password123", "Password");
			yield* submit();
			yield* eventually(() => expect(heading()).toBe("Notes"));
			expect(href()).toBe("/");
		},
	);
}

signInApp.it(
	"an Unauthorized route returns to the note and its query after sign-in",
	[signInVisitor("/notes/1?tab=history")],
	function* ({ alert, followLink, heading, enter, submit, href, caught, draft }) {
		yield* eventually(() => expect(alert()).toBe("Sign in to view your notes."));
		expect(caught()).toEqual([expect.objectContaining({ _tag: "Unauthorized" })]);
		yield* followLink("Sign in");
		yield* eventually(() => expect(heading()).toBe("Sign in"));
		expect(new URL(href(), "http://app.test").searchParams.get("returnTo")).toBe("/notes/1?tab=history");
		yield* enter("alice@app.test", "Email");
		yield* enter("password123", "Password");
		yield* submit();
		yield* eventually(() => expect(draft()).toBe("Deep note"));
		expect(href()).toBe("/notes/1?tab=history");
	},
);

signInApp.it(
	"a refused save rechecks the still-signed-in session once",
	[signInVisitor("/", true)],
	function* ({ heading, expireSession, enter, submit, alert, authRequests }) {
		yield* eventually(() => expect(heading()).toBe("Notes"));
		yield* expireSession();
		yield* enter("Retain this draft");
		yield* submit();
		yield* eventually(() => expect(alert()).toBe("Sign in to add a note."));
		yield* eventually(() =>
			expect(
				authRequests()
					.map((url) => url.pathname)
					.filter((path) => path === "/api/auth/get-session"),
			).toEqual(["/api/auth/get-session", "/api/auth/get-session"]),
		);
		yield* enter("A newer draft");
		expect(
			authRequests()
				.map((url) => url.pathname)
				.filter((path) => path === "/api/auth/get-session"),
		).toEqual(["/api/auth/get-session", "/api/auth/get-session"]);
	},
);
