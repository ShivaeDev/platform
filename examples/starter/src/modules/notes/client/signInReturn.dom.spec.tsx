import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screens as signInApp } from "#modules/notes/test-support/screens.ts";
import { signInVisitor } from "#modules/notes/test-support/signInVisitor.tsx";

const SIGNED_TARGET =
	"/resume?resume=%2Foauth%2Fconsent%3Fscope%3Da%2520b&scope=a%20b&lower=%2f&repeat=first&repeat=last&empty&code=123&state=%22signed%22&signature=a%2Bb%2Fc%3D";

signInApp.it(
	"a signed-in-only route sends a visitor to sign-in and returns to its exact URL afterwards",
	[signInVisitor(SIGNED_TARGET)],
	function* ({ heading, href, settle, submitsCredentials }) {
		yield* settle();
		expect(new URL(yield* href(), "http://app.test").searchParams.get("returnTo")).toBe(SIGNED_TARGET);

		yield* submitsCredentials("sign-in");
		yield* settle();

		yield* outcomes([
			["page", heading, "Your app"],
			["location", href, SIGNED_TARGET],
		]);
	},
);

signInApp.it(
	"a module's Sign in link returns the visitor to the module page after signing in",
	[signInVisitor("/resume?tab=history", false, true)],
	function* ({ followLink, heading, href, settle, submitsCredentials }) {
		yield* settle();
		yield* followLink("Sign in");
		yield* settle();
		expect(new URL(yield* href(), "http://app.test").searchParams.get("returnTo")).toBe("/resume?tab=history");

		yield* submitsCredentials("sign-in");
		yield* settle();

		yield* outcomes([
			["page", heading, "Your app"],
			["location", href, "/resume?tab=history"],
		]);
	},
);

signInApp.it(
	"a note route returns to the note and its query after sign-in",
	[signInVisitor("/notes/1?tab=history")],
	function* ({ draft, href, settle, submitsCredentials }) {
		yield* settle();
		expect(new URL(yield* href(), "http://app.test").searchParams.get("returnTo")).toBe("/notes/1?tab=history");

		yield* submitsCredentials("sign-in");
		yield* settle();

		yield* outcomes([
			["editor", draft, "Deep note"],
			["location", href, "/notes/1?tab=history"],
		]);
	},
);

for (const target of ["https://elsewhere.test/resume", "//elsewhere.test/resume", "/\\elsewhere.test/resume", "javascript:alert(1)"]) {
	signInApp.it(
		`signing in ignores the external return target ${target} and opens Notes`,
		[signInVisitor(`/sign-in?returnTo=${encodeURIComponent(target)}`)],
		function* ({ heading, href, settle, submitsCredentials }) {
			yield* settle();

			yield* submitsCredentials("sign-in");
			yield* settle();

			yield* outcomes([
				["page", heading, "Notes"],
				["location", href, "/"],
			]);
		},
	);
}

signInApp.it(
	"after alice signs out, a session refresh keeps her on sign-in instead of the deep link she left",
	[signInVisitor(SIGNED_TARGET, true)],
	function* ({ click, heading, href, refreshSession, settle }) {
		yield* settle();
		expect(yield* href()).toBe(SIGNED_TARGET);
		yield* click("Sign out");
		yield* settle();
		expect(yield* href()).toBe("/sign-in");

		yield* refreshSession();
		yield* settle();

		yield* outcomes([
			["page", heading, "Sign in"],
			["location", href, "/sign-in"],
		]);
	},
);

signInApp.it(
	"a save refused for an expired session rechecks alice's session once and keeps her on Notes",
	[signInVisitor("/", true)],
	function* ({ alert, enter, expireSession, heading, href, sessionChecks, settle, submit }) {
		yield* settle();
		expect(yield* sessionChecks()).toBe("one session check");
		yield* expireSession();
		yield* enter("Retain this draft");

		yield* submit();
		yield* settle();

		yield* outcomes([
			["page", heading, "Notes"],
			["location", href, "/"],
			["alert", alert, "Sign in to add a note."],
			["session checks", sessionChecks, "2 session checks"],
		]);
	},
);

signInApp.it(
	"typing after a refused save does not recheck alice's session again",
	[signInVisitor("/", true)],
	function* ({ enter, expireSession, sessionChecks, settle, submit }) {
		yield* settle();
		yield* expireSession();
		yield* enter("Retain this draft");
		yield* submit();
		yield* settle();
		expect(yield* sessionChecks()).toBe("2 session checks");

		yield* enter("A newer draft");
		yield* settle();

		expect(yield* sessionChecks()).toBe("2 session checks");
	},
);
