import { loginScreen, screens } from "#test-support/screens.ts";

screens.it(
	"submits signup and sign-in, retains rejected input, and shows provider and network failures",
	[loginScreen("Email is already registered")],
	function* ({
		click,
		enter,
		submit,
		authenticationCallsAre,
		alertSays,
		draftIs,
		authenticatedTimes,
		authenticationAccepts,
		authenticationGoesOffline,
		lastAuthenticationModeIs,
	}) {
		yield* click("Create an account");
		yield* enter("Alice", "Name");
		yield* enter("alice@app.test", "Email");
		yield* enter("correct-horse", "Password");
		yield* submit();
		yield* authenticationCallsAre([{ credentials: { email: "alice@app.test", name: "Alice", password: "correct-horse" }, mode: "sign-up" }]);
		yield* alertSays("Email is already registered");
		yield* draftIs("alice@app.test", "Email");
		yield* authenticatedTimes(0);
		yield* authenticationAccepts();
		yield* submit();
		yield* authenticatedTimes(1);
		yield* click("Use an existing account");
		yield* authenticationGoesOffline();
		yield* submit();
		yield* lastAuthenticationModeIs("sign-in");
		yield* alertSays("Could not reach authentication. Try again.");
		yield* authenticationAccepts();
		yield* submit();
		yield* authenticatedTimes(2);
	},
);
