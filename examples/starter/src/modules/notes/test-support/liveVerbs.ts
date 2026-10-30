import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Engine } from "#modules/notes/test-support/applicationState.ts";
import { listHints } from "#modules/notes/test-support/listHints.ts";
import { liveNote, liveNotes } from "#modules/notes/test-support/live.ts";
import type { RunningHost } from "#test-support/host.ts";

export function liveVerbs(engine: Engine, host: () => RunningHost, tell: (line: string) => void) {
	function cookie(name: string) {
		const actor = engine.actors.get(name);
		if (actor === undefined) {
			throw new Error(`No signed-in account ${name}`);
		}
		return actor.cookie;
	}
	return {
		failNoteReads: Effect.gen(function* () {
			tell("PostgreSQL reports connection failures for note reads while sessions remain available");
			const sql = yield* SqlClient.SqlClient;
			yield* sql`alter table notes rename to available_notes`;
			yield* sql`create function unavailable_notes() returns setof available_notes language plpgsql as $$begin raise exception 'connection lost' using errcode = '08006'; end$$`;
			yield* sql`create view notes as select * from unavailable_notes()`;
		}),
		listHints: (name = "alice") => {
			tell(`${name} listens for list hints over the socket`);
			return listHints(host(), cookie(name));
		},
		liveNote: (id: number, name = "alice") => {
			tell(`${name} watches note ${id} live`);
			return liveNote(host(), cookie(name), id);
		},
		liveNotes: (name = "alice") => {
			tell(`${name} watches the live notes list`);
			return liveNotes(host(), cookie(name));
		},
	};
}
