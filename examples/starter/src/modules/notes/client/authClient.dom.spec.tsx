import { expect } from "vitest";
import { failingSessionCheck, refusedAppSignOut, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"checks and retries the session through its injected auth client",
	[failingSessionCheck()],
	function* ({ settle, closeScreen, consoleErrors, alert, recoverSessionCheck, click, heading, authRequests }) {
		yield* settle();
		expect(alert()).toBe("Could not check your session.");
		yield* recoverSessionCheck();
		yield* click("Retry");
		yield* settle();
		expect(heading()).toBe("Sign in");
		expect(authRequests().map((url) => url.href)).toEqual([
			"http://session.story.test/api/auth/get-session",
			"http://session.story.test/api/auth/get-session",
		]);
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"routes sign-out through the same injected auth client as its session check",
	[refusedAppSignOut("Provider refused sign-out")],
	function* ({ settle, closeScreen, consoleErrors, screenText, click, alert, authRequests }) {
		yield* settle();
		expect(screenText()).toContain("No notes yet");
		yield* click("Sign out");
		yield* settle();
		expect(alert()).toBe("Could not sign out. Try again.");
		expect(authRequests().some((url) => url.pathname === "/api/auth/sign-out")).toBe(true);
		expect(authRequests().every((url) => url.origin === "http://actions.story.test")).toBe(true);
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
