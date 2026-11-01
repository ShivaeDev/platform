import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";
import { answer } from "#test-support/answers.ts";

app.it("alice's auth client reads her session from the app host", [signedIn("alice")], function* ({ authClientSession }) {
	const session = yield* authClientSession("alice");

	expect(session).toEqual({ account: "alice", email: "alice@app.test" });
});

app.it(
	"signing out through the auth client ends alice's session and her access to notes",
	[signedIn("alice")],
	function* ({ authClientSession, notesOf, signsOutThroughAuthClient }) {
		expect(yield* answer(notesOf("alice").list())).toEqual([]);

		yield* signsOutThroughAuthClient("alice");

		yield* outcomes([
			["alice's session", () => authClientSession("alice"), "no session"],
			["alice's notes", () => answer(notesOf("alice").list()), "sign in required"],
		]);
	},
);
