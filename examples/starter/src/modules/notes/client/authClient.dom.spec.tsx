import { expect } from "vitest";
import { eventually } from "@shivaedev/react/client/testing.ts";
import { failingSessionCheck, refusedAppSignOut, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"checks and retries the session through its injected auth client",
	[failingSessionCheck()],
	function* ({ closeScreen, consoleErrors, alert, recoverSessionCheck, click, heading, authRequests }) {
		yield* eventually(() => expect(alert()).toBe("Could not check your session."));
		yield* recoverSessionCheck();
		yield* click("Retry");
		yield* eventually(() => expect(heading()).toBe("Sign in"));
		yield* eventually(() =>
			expect(authRequests().map((url) => url.href)).toEqual([
				"http://session.story.test/api/auth/get-session",
				"http://session.story.test/api/auth/get-session",
			]),
		);
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"routes sign-out through the same injected auth client as its session check",
	[refusedAppSignOut("Provider refused sign-out")],
	function* ({ closeScreen, consoleErrors, screenText, click, alert, authRequests }) {
		yield* eventually(() => expect(screenText()).toContain("No notes yet"));
		yield* click("Sign out");
		yield* eventually(() => expect(alert()).toBe("Provider refused sign-out"));
		yield* eventually(() => expect(authRequests().some((url) => url.pathname === "/api/auth/sign-out")).toBe(true));
		expect(authRequests().every((url) => url.origin === "http://actions.story.test")).toBe(true);
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
