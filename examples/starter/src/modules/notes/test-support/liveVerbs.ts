import type { RunningHost } from "#test-support/host.ts";
import type { Engine } from "./applicationState.ts";
import { listHints } from "./listHints.ts";
import { liveNote, liveNotes } from "./live.ts";

export function liveVerbs(engine: Engine, host: () => RunningHost, tell: (line: string) => void) {
	function cookie(name: string) {
		const actor = engine.actors.get(name);
		if (actor === undefined) {
			throw new Error(`No signed-in account ${name}`);
		}
		return actor.cookie;
	}
	return {
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
