import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ownerMarks } from "#test/ownerMarks.ts";

ownerMarks.it(
	"the collected owned models hold each model makeRepository and makeOrderedChildren built with an owner field, with its table, field and column as the client's name transform stores them, and not the unowned model",
	[],
	function* ({ build, owned }) {
		yield* build("notes owned by their author bucket");
		yield* build("checklist steps through makeOrderedChildren");
		yield* build("unowned note tags");

		expect(yield* owned()).toEqual([
			{ model: "Note", owner: { column: "author_id", field: "authorId" }, table: "notes" },
			{ model: "Step", owner: { column: "user_id", field: "userId" }, table: "checklist_steps" },
		]);
	},
);

ownerMarks.it(
	"a repository built twice is collected once, while two models over the notes table are both collected",
	[],
	function* ({ build, owned }) {
		yield* build("notes owned by their author bucket");
		yield* build("notes owned by their author bucket");
		yield* build("note headings over the notes table");

		expect(yield* owned()).toEqual([
			{ model: "Note", owner: { column: "author_id", field: "authorId" }, table: "notes" },
			{ model: "NoteHeading", owner: { column: "author_id", field: "authorId" }, table: "notes" },
		]);
	},
);

ownerMarks.it("an owner mark on a bucket field keeps the bucket, so the repository still needs the bucket's collection", [], function* ({ build }) {
	yield* outcomes([
		["built with its collection", () => build("notes owned by their author bucket"), "built"],
		[
			"built by tableName",
			() => build("notes keyed by tableName in place of their collection"),
			'BucketRegistrationError: Bucket registration for notes: model bucket fields ["authorId"] need the repository\'s collection option in place of tableName: a collection named "notes" with exactly those bucket fields',
		],
	]);
});

const refusals = [
	{
		built: "co-authored notes with two owner fields",
		refusal:
			'OwnerFieldError: Repository for co_authored_notes: owner fields ["authorId","editorId"] each claim the row\'s person; mark exactly one field as owner',
	},
	{
		built: "notes owned by a server-only token",
		refusal:
			'OwnerFieldError: Repository for hidden_owner_notes: owner field ["ownerToken"] is server-only, but it must decode to the plain user id that selects a person\'s rows for export and erasure',
	},
] as const;

for (const { built, refusal } of refusals) {
	ownerMarks.it(
		`building the repository of ${built} fails, naming the table and the fields, and collects no owned model`,
		[],
		function* ({ build, owned }) {
			yield* outcomes([
				["build", () => build(built), refusal],
				["owned models", () => owned(), []],
			]);
		},
	);
}
