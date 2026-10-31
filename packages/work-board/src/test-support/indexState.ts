import { stateOf } from "#browser/views/state.ts";
import { attentionRequests } from "#server/attention/requests.ts";
import { backlinksOf } from "#server/metadata/backlinks.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { projectItems } from "#server/views/projection.ts";

export function indexState(snapshot: Snapshot) {
	return {
		attention: attentionRequests(snapshot),
		backlinks: snapshot.documents.map((document) => [document.file, backlinksOf(document.file, snapshot.model)]),
		diagnostics: [...snapshot.model.diagnostics],
		documents: snapshot.documents,
		entries: snapshot.entries,
		ids: [...snapshot.model.ids],
		rootFile: snapshot.model.rootFile,
		unavailable: snapshot.unavailable,
		views: ["", "?board=board", "?owner=value%3Aagent&status=value%3Aplanned&sort=title"].map((query) => projectItems(snapshot, stateOf(query))),
	};
}
