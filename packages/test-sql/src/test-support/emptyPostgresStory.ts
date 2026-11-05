import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { emptyPostgres } from "#server/emptyPostgres.ts";
import { withIsolatedDatabase } from "#server/withIsolatedDatabase.ts";
import { adminUrl, configured } from "#test/postgres.ts";

export const emptyPostgresStory = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	*create() {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table notes (body text not null)`;
		return { sql };
	},
	layer: emptyPostgres(adminUrl),
	name: "consumer-selected PostgreSQL template",
	runIf: configured,
	stages: [],
	verbs: ({ sql }, story) => ({
		notes: () => sql<{ body: string }>`select body from notes order by body`,
		recordNote: (body: string) => {
			story.tell(`the consumer records the note ${body}`);
			return sql`insert into notes values (${body})`;
		},
	}),
});
