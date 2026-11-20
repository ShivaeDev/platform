import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { answered } from "#test/answers.ts";
import { engine, type Writer } from "#test/stale-writes/engine.ts";
import { configured, database } from "#test/stale-writes/fixture.ts";

export const staleWritesStory = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => engine,
	layer: database,
	name: "two writers of one versioned note in a defined module over PostgreSQL",
	runIf: configured,
	stages: [],
	verbs: (current, story) => ({
		opens: (writer: Writer) =>
			Effect.gen(function* () {
				const [row] = yield* current.stored;
				current.read[writer] = row?.version ?? -1;
				story.tell(`${writer} opens the note at version ${current.read[writer]}`);
			}),
		removes: (writer: Writer) => {
			story.tell(`${writer} removes the note she opened`);
			return answered(current.clients[writer]("staleNotes.remove", { id: 1, version: current.read[writer] }), () => "removed");
		},
		renames: (writer: Writer, title: string) => {
			story.tell(`${writer} renames the note she opened to ${title}`);
			return answered(
				current.clients[writer]("staleNotes.rename", { id: 1, title, version: current.read[writer] }),
				(saved) => `saved at version ${saved}`,
			);
		},
		storedNote: () => Effect.map(current.stored, ([row]) => (row === undefined ? "no note" : `${row.title} at version ${row.version}`)),
	}),
});
