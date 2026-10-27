import { expect } from "vitest";
import { signInApp, visitor } from "#test-support/signInStories.tsx";

const SIGNED_TARGET = "/resume?resume=%2Foauth%2Fconsent%3Fscope%3Da%2520b&code=123&state=%22signed%22&signature=a%2Bb%2Fc%3D";
for (const [path, moduleLink] of [
	[SIGNED_TARGET, false],
	["/resume?tab=history", true],
] as const) {
	signInApp.it(
		`returns to ${path} after signing in${moduleLink ? " from a module link" : " through a permission guard"}`,
		[visitor(path, false, moduleLink)],
		function* ({ heading, observe, href, followLink, enter, submit }) {
			if (moduleLink) {
				yield* observe(() => expect(heading()).toBe("Your app"));
				yield* followLink("Sign in");
			}
			yield* observe(() => expect(heading()).toBe("Sign in"));
			expect(new URL(href(), "http://app.test").searchParams.get("returnTo")).toBe(path);
			yield* enter("alice@app.test", "Email");
			yield* enter("password123", "Password");
			yield* submit();
			yield* observe(() => expect(heading()).toBe("Your app"));
			expect(href()).toBe(path);
		},
	);
}

signInApp.it(
	"an explicit sign-out forgets the protected deep link across session refresh",
	[visitor(SIGNED_TARGET, true)],
	function* ({ observe, heading, click, href, requests }) {
		yield* observe(() => expect(heading()).toBe("Your app"));
		yield* click("Sign out");
		yield* observe(() => expect(heading()).toBe("Sign in"));
		yield* observe(() => expect(requests().filter((path) => path === "/api/auth/get-session").length).toBeGreaterThanOrEqual(2));
		expect(href()).toBe("/sign-in");
	},
);

for (const target of ["https://elsewhere.test/resume", "//elsewhere.test/resume", "/\\elsewhere.test/resume", "javascript:alert(1)"]) {
	signInApp.it(
		`refuses the external return target ${target}`,
		[visitor(`/sign-in?returnTo=${encodeURIComponent(target)}`)],
		function* ({ observe, heading, enter, submit, href }) {
			yield* observe(() => expect(heading()).toBe("Sign in"));
			yield* enter("alice@app.test", "Email");
			yield* enter("password123", "Password");
			yield* submit();
			yield* observe(() => expect(heading()).toBe("Notes"));
			expect(href()).toBe("/");
		},
	);
}

signInApp.it(
	"an Unauthorized route returns to the note and its query after sign-in",
	[visitor("/notes/1?tab=history")],
	function* ({ observe, alert, followLink, heading, enter, submit, href, caught, draft }) {
		yield* observe(() => expect(alert()).toBe("Sign in to view your notes."));
		expect(caught()).toEqual([expect.objectContaining({ _tag: "Unauthorized" })]);
		yield* followLink("Sign in");
		yield* observe(() => expect(heading()).toBe("Sign in"));
		expect(new URL(href(), "http://app.test").searchParams.get("returnTo")).toBe("/notes/1?tab=history");
		yield* enter("alice@app.test", "Email");
		yield* enter("password123", "Password");
		yield* submit();
		yield* observe(() => expect(draft()).toBe("Deep note"));
		expect(href()).toBe("/notes/1?tab=history");
	},
);

signInApp.it(
	"a refused save rechecks the still-SIGNED_TARGET-in session once",
	[visitor("/", true)],
	function* ({ observe, heading, expireRpc, enter, submit, alert, requests }) {
		yield* observe(() => expect(heading()).toBe("Notes"));
		yield* expireRpc();
		yield* enter("Retain this draft");
		yield* submit();
		yield* observe(() => expect(alert()).toBe("Sign in to add a note."));
		yield* observe(() =>
			expect(requests().filter((path) => path === "/api/auth/get-session")).toEqual(["/api/auth/get-session", "/api/auth/get-session"]),
		);
		yield* enter("A newer draft");
		expect(requests().filter((path) => path === "/api/auth/get-session")).toEqual(["/api/auth/get-session", "/api/auth/get-session"]);
	},
);
