import { DateTime, Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { mintUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { notesHttp } from "#modules/notes/test-support/http.ts";
import { AppAuth } from "#server/AppAuth.ts";
import { accountScreen, accountVerbs } from "#test-support/accountDeletion.ts";
import { configured, postgres } from "#test-support/postgres.ts";

const NoteRow = Schema.Struct({ title: Schema.String, userId: Schema.String });

export const deletedAccountNotes = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const screen = yield* accountScreen();
		const bob = yield* mintUser(AppAuth, screen, "bob");
		for (const [title, cookie] of [
			["Alice's note", screen.account.headers.get("cookie")],
			["Bob's note", bob.headers.get("cookie")],
		] as const) {
			const notes = yield* notesHttp(screen.baseUrl, cookie ?? "", screen.origin);
			yield* notes["notes.create"]({ title });
		}
		return { ...screen, bob };
	},
	inspect: ({ history, view }) => ({ route: history.location.pathname, text: view.container.ownerDocument.body.textContent }),
	layer: postgres,
	name: "notes of a deleted account",
	runIf: configured,
	stages: [],
	verbs: (engine, story) => ({
		...accountVerbs(engine, story.tell),
		storedNoteOwners: Effect.fn("DeletedAccountNotesStory.storedNoteOwners")(function* () {
			const sql = yield* SqlClient.SqlClient;
			const rows = yield* SqlSchema.findAll({
				execute: () => sql`select title, user_id from notes order by title`,
				Request: Schema.Void,
				Result: NoteRow,
			})(undefined);
			const names = new Map([
				[engine.account.user.id, "alice"],
				[engine.bob.user.id, "bob"],
			]);
			return rows.map(({ title, userId }) => `${title} of ${names.get(userId) ?? userId}`);
		}),
	}),
});
