import { failingSessionCheck, refusedAppSignOut, screens } from "#test-support/screens.ts";

screens.it(
	"checks and retries the session through its injected auth client",
	[failingSessionCheck()],
	function* ({ alertSays, recoverSessionCheck, click, headingIs, authRequestsAre }) {
		yield* alertSays("Could not check your session.");
		yield* recoverSessionCheck();
		yield* click("Retry");
		yield* headingIs("Sign in");
		yield* authRequestsAre("http://session.story.test/api/auth/get-session", "http://session.story.test/api/auth/get-session");
	},
);

screens.it(
	"routes sign-out through the same injected auth client as its session check",
	[refusedAppSignOut("Provider refused sign-out")],
	function* ({ screenSays, click, alertSays, signOutUsedAuthOrigin }) {
		yield* screenSays("No notes yet");
		yield* click("Sign out");
		yield* alertSays("Provider refused sign-out");
		yield* signOutUsedAuthOrigin("http://actions.story.test");
	},
);
