import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { loginScreen, screens } from "#modules/notes/test-support/screens.ts";

const NO_AUTHENTICATIONS = 0;
const AFTER_SIGN_UP = 1;
const AFTER_SIGN_IN = 2;

screens.it(
	"submits signup and sign-in, retains rejected input, and shows provider and network failures",
	[loginScreen("Email is already registered")],
	function* ({
		closeScreen,
		consoleErrors,
		click,
		enter,
		submit,
		authenticationCalls,
		alert,
		draft,
		authenticationCount,
		authenticationAccepts,
		authenticationGoesOffline,
		lastAuthenticationMode,
	}) {
		yield* click("Create an account");
		yield* enter("Alice", "Name");
		yield* enter("alice@app.test", "Email");
		yield* enter("correct-horse", "Password");
		yield* submit();
		yield* Effect.promise(() =>
			eventually(() =>
				expect(authenticationCalls()).toEqual([
					{ credentials: { email: "alice@app.test", name: "Alice", password: "correct-horse" }, mode: "sign-up" },
				]),
			),
		);
		yield* Effect.promise(() => eventually(() => expect(alert()).toBe("Email is already registered")));
		yield* Effect.promise(() => eventually(() => expect(draft("Email")).toBe("alice@app.test")));
		yield* Effect.promise(() => eventually(() => expect(authenticationCount()).toBe(NO_AUTHENTICATIONS)));
		yield* authenticationAccepts();
		yield* submit();
		yield* Effect.promise(() => eventually(() => expect(authenticationCount()).toBe(AFTER_SIGN_UP)));
		yield* click("Use an existing account");
		yield* authenticationGoesOffline();
		yield* submit();
		yield* Effect.promise(() => eventually(() => expect(lastAuthenticationMode()).toBe("sign-in")));
		yield* Effect.promise(() => eventually(() => expect(alert()).toBe("Could not reach authentication. Try again.")));
		yield* authenticationAccepts();
		yield* submit();
		yield* Effect.promise(() => eventually(() => expect(authenticationCount()).toBe(AFTER_SIGN_IN)));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
