import { Effect } from "effect";
import { NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import type { BoardProjection, InboxProjection, OverviewProjection, WorkProjection } from "#browser/views/schema.ts";
import { stateOf } from "#browser/views/state.ts";
import { inboxItems } from "#server/attention/inbox.ts";
import { attentionRequests } from "#server/attention/requests.ts";
import { identityUrl, referenceTarget } from "#server/metadata/links.ts";
import { boardOf, countsOf } from "#server/render/board.ts";
import type { HandlerOptions } from "#server/rpc/HandlerOptions.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import type { Item } from "./items.ts";
import { projectItems } from "./projection.ts";

export function projectionQueries({ index, document }: { readonly index: HandlerOptions["index"]; readonly document: HandlerOptions["document"] }) {
	function read(url: string) {
		return document ? document(url) : Effect.fail(new NotFound({ message: "The document is missing." }));
	}
	return {
		board: (url: string) => Effect.map(read(url), (data): BoardProjection => ({ counts: countsOf(boardOf(data.source)), document: data })),
		inbox: () => Effect.map(index, inboxProjection),
		overview: () => Effect.map(index, overviewProjection),
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
				function toItem({ document: source, id, title }: Item) {
					return { file: source.file, id, metadata: source.parsed.fields, title, waiting: waiting.get(id) };
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
}
function inboxProjection(snapshot: Snapshot): InboxProjection {
	return {
		complete: snapshot.unavailable.length === 0,
		items: inboxItems(snapshot).map(({ document, ...item }) => ({ ...item, file: document.file })),
		sourceIssues: snapshot.model.documents.some((document) => (snapshot.model.diagnostics.get(document.file)?.length ?? 0) > 0),
	};
}
function overviewProjection(snapshot: Snapshot): OverviewProjection {
	const projection = attentionRequests(snapshot);
	return {
		...projection,
		entries: projection.entries.map(({ document, request, ...entry }) => ({
			...entry,
			file: document.file,
			id: request.id,
			kind: request.kind,
			reason: request.reason,
			responseFrom: request.responseFrom,
			unblocks: request.unblocks.map((target) => ({ href: referenceTarget(target, snapshot.model), label: target })),
		})),
		inboxCount: inboxItems(snapshot).length,
		unavailable: snapshot.unavailable,
	};
}

function selectionProblem(snapshot: Snapshot, item: string) {
	return (snapshot.model.ids.get(item)?.length ?? 0) > 1 ? "has a duplicate ID" : "is missing or its identity changed";
}
