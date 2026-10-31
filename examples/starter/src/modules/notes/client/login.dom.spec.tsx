import { expect } from "vitest";
import { loginScreen, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"submits signup and sign-in, retains rejected input, and shows provider and network failures",
	[loginScreen("Email is already registered")],
	function* ({
		settle,
		closeScreen,
		consoleErrors,
		click,
		enter,
		submit,
		authenticationCalls,
		alert,
		draft,
		authenticated,
		authenticationAccepts,
		authenticationGoesOffline,
		lastAuthenticationMode,
	}) {
		yield* click("Create an account");
		yield* enter("Alice", "Name");
		yield* enter("alice@app.test", "Email");
		yield* enter("correct-horse", "Password");
		yield* submit();
		yield* settle();
		expect(authenticationCalls()).toEqual([{ credentials: { email: "alice@app.test", name: "Alice", password: "correct-horse" }, mode: "sign-up" }]);
		expect(alert()).toBe("Email is already registered");
		expect(draft("Email")).toBe("alice@app.test");
		expect(authenticated()).toEqual([]);
		yield* authenticationAccepts();
		yield* submit();
		yield* settle();
		expect(authenticated()).toEqual(["sign-up"]);
		yield* click("Use an existing account");
		yield* authenticationGoesOffline();
		yield* submit();
		yield* settle();
		expect(lastAuthenticationMode()).toBe("sign-in");
		expect(alert()).toBe("Could not reach authentication. Try again.");
		yield* authenticationAccepts();
		yield* submit();
		yield* settle();
		expect(authenticated()).toEqual(["sign-up", "sign-in"]);
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
