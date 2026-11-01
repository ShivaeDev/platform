import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, reservedTitleConstraint, signedIn } from "#modules/notes/test-support/application.ts";
import { refusal } from "#test-support/answers.ts";

app.it(
	"a title a PostgreSQL constraint rejects answers conflict and is not saved",
	[signedIn("alice"), reservedTitleConstraint()],
	function* ({ notesOf }) {
		const created = yield* refusal(notesOf("alice").create("Reserved"));

		yield* outcomes([
			["alice's create", () => Effect.succeed(created), "conflict: The note violates a database constraint"],
			["alice's notes", () => notesOf("alice").list(), []],
		]);
	},
);
