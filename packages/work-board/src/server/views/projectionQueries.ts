import { Effect } from "effect";
import type { BoardProjection, WorkProjection } from "#browser/views/schema.ts";
import { stateOf } from "#browser/views/state.ts";
import { inboxItems } from "#server/attention/inbox.ts";
import { attentionProjection } from "#server/attention/projection.ts";
import { requestInbox } from "#server/attention/requestInbox.ts";
import { identityUrl } from "#server/metadata/links.ts";
import { boardOf, countsOf } from "#server/render/board.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { Workspace } from "#server/workspace.ts";
import { fleetApproval } from "./fleetApproval.ts";
import type { Item } from "./items.ts";
import { projectItems } from "./projection.ts";

export const projectionQueries = Effect.gen(function* () {
	const workspace = yield* Workspace;
	const index = workspace.index();
	const read = workspace.document;
	return {
		board: (url: string) => Effect.map(read(url), (data): BoardProjection => ({ counts: countsOf(boardOf(data.source)), document: data })),
		inbox: () => Effect.map(index, attentionProjection),
		work: (url: string) =>
			Effect.gen(function* () {
				const snapshot = yield* index;
				const state = stateOf(url);
				const projection = projectItems(snapshot, state);
				const waiting = new Map(
					inboxItems(snapshot)
						.filter((entry) => !entry.problem)
						.map((entry) => [entry.id, entry.reason]),
				);
				const answered = new Map(requestInbox(snapshot).answered.map((entry) => [entry.id, entry.answered]));
				function toItem({ document: source, id, title }: Item) {
					return {
						answered: answered.get(id),
						file: source.file,
						fleetApproved: fleetApproval(source.parsed),
						id,
						metadata: source.parsed.fields,
						title,
						waiting: waiting.get(id),
					};
				}
				const selected = projection.selected ? yield* read(identityUrl(projection.selected.id)) : undefined;
				return {
					boards: projection.boards.map(toItem),
					issues: projection.issues,
					items: projection.items.map(toItem),
					rows: projection.rows.map(toItem),
					selected,
					selectedOutside: projection.selectedOutside,
					selectionProblem: !state.item || selected ? undefined : selectionProblem(snapshot, state.item),
					state,
					title: projection.title,
					validBoard: projection.validBoard,
				} satisfies WorkProjection;
			}),
	};
});
function selectionProblem(snapshot: Snapshot, item: string) {
	return (snapshot.model.ids.get(item)?.length ?? 0) > 1 ? "has a duplicate ID" : "is missing or its identity changed";
}
