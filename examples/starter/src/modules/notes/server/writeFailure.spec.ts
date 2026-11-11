import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, reservedTitleConstraint, signedIn } from "#modules/notes/test-support/application.ts";
import { answer } from "#test-support/answers.ts";

app.it(
	"a title a PostgreSQL constraint rejects, which no operation maps, answers internal server error and is not saved",
	[signedIn("alice"), reservedTitleConstraint()],
	function* ({ notesOf }) {
		const created = yield* answer(notesOf("alice").create("Reserved"));

		yield* outcomes([
			["alice's create", () => Effect.succeed(created), "internal server error"],
			["alice's notes", () => notesOf("alice").list(), []],
		]);
	},
);
