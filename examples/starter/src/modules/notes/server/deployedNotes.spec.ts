import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, behindHttpsProxy } from "#modules/notes/test-support/application.ts";
import { answer } from "#test-support/answers.ts";

app.it(
	"behind an HTTPS proxy, alice signs up with a secure session cookie that opens her notes",
	[behindHttpsProxy("with PUBLIC_URL")],
	function* ({ notesOf, signsUp }) {
		const signedUp = yield* signsUp("alice");

		yield* outcomes([
			["alice's sign-up", () => Effect.succeed(signedUp), "signed up with a secure session cookie"],
			["alice's notes", () => answer(notesOf("alice").list()), []],
		]);
	},
);
