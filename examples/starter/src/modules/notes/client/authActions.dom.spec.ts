import { Option } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { aliceAccount, authScreen, notesApp, signInResponseHeld } from "#modules/notes/test-support/app.tsx";

notesApp.it(
	"shows the typed Better Auth rejection after a pending sign-in and re-enables sign-in",
	[aliceAccount(), signInResponseHeld(), authScreen()],
	function* ({ enter, click, button, heading, releaseSignIn, signInFailure, alert }) {
		yield* eventually(() => expect(heading()).toBe("Sign in"));
		yield* enter("alice@app.test", "Email");
		yield* enter("incorrect-password", "Password");
		yield* click("Sign in");
		yield* eventually(() => expect(button("Please wait…")).toEqual({ disabled: true, text: "Please wait…" }));
		expect(alert()).toBeUndefined();
		yield* releaseSignIn();
		yield* eventually(() => expect(alert()).toBe("Invalid email or password"));
		expect(Option.getOrThrow(signInFailure())).toMatchObject({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 });
		expect(button("Sign in")).toEqual({ disabled: false, text: "Sign in" });
		expect(heading()).toBe("Sign in");
	},
);
