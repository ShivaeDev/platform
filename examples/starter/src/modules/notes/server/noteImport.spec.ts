import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, malformedSourceNote, signedIn, sourceNoteMissing } from "#modules/notes/test-support/application.ts";
import { refusal } from "#test-support/answers.ts";

app.it("alice imports a source note's title into her notes over outbound HTTP", [signedIn("alice")], function* ({ notesOf, sourceRequests }) {
	expect(yield* notesOf("alice").list()).toEqual([]);

	const imported = yield* notesOf("alice").import(7);

	yield* outcomes([
		["the imported title", () => Effect.succeed(imported.title), "A note from outside"],
		["alice's notes", () => notesOf("alice").list(), [imported]],
		["requests to the source API", () => Effect.sync(sourceRequests), [{ method: "GET", path: "/posts/7", status: HttpStatus.fromLiteral("OK") }]],
	]);
});

const sourceFaults = [
	["answers Not Found", sourceNoteMissing(), "not found: Source note not found"],
	["answers with a malformed note", malformedSourceNote(), "service unavailable: Could not read the source note"],
] as const;

for (const [fault, trait, refused] of sourceFaults) {
	app.it(`when the source API ${fault}, alice's import answers "${refused}" and saves no note`, [trait, signedIn("alice")], function* ({ notesOf }) {
		expect(yield* notesOf("alice").list()).toEqual([]);

		const answered = yield* refusal(notesOf("alice").import(7));

		yield* outcomes([
			["alice's import", () => Effect.succeed(answered), refused],
			["alice's notes", () => notesOf("alice").list(), []],
		]);
	});
}
