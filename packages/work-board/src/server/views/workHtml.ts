import { Effect } from "effect";
import { escapeHtml } from "#browser/escapeHtml.ts";
import { laneOf, nowLanes } from "#browser/views/now.ts";
import { inboxItems } from "#server/attention/inbox.ts";
import { identityUrl } from "#server/metadata/links.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { fleetApproval } from "./fleetApproval.ts";
import { projectItems } from "./projection.ts";
import type { State } from "./state.ts";
import { viewTools } from "./tools.ts";
import { workCards } from "./workCards.ts";
import { workControls } from "./workControls.ts";
import { workDetail } from "./workDetail.ts";
import { workTable } from "./workTable.ts";

export const workHtml = Effect.fn("WorkBoard.workHtml")(function* (snapshot: Snapshot, state: State) {
	const projection = projectItems(snapshot, state);
	const waiting = new Map(
		inboxItems(snapshot)
			.filter((item) => !item.problem)
			.map((item) => [item.id, item.reason]),
	);
	const shown =
		state.view === "now"
			? projection.rows.filter((item) => {
					const lane = laneOf(item.document.parsed.fields, undefined, fleetApproval(item.document.parsed));
					return lane !== undefined && lane !== nowLanes[5];
				}).length
			: projection.rows.length;
	const total =
		state.view === "now" ? projection.items.filter((item) => item.document.parsed.fields.kind === "task").length : projection.items.length;
	const controls = workControls(projection, state);
	const tools = viewTools(state, controls);
	if (!projection.validBoard) {
		return {
			html: `<h1>Board unavailable</h1>${tools}<p class="empty">${escapeHtml(state.board)} is missing, has a duplicate ID, or is not a declared board. Choose another board or open its <a href="${escapeHtml(identityUrl(state.board))}">source identity</a>.</p>`,
			status: 404,
		};
	}
	const issues =
		projection.issues.length > 0
			? `<details class="view-issues"><summary>Source issues (${projection.issues.length})</summary><ul>${projection.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul></details>`
			: "";
	const source = state.board ? `<a href="${escapeHtml(identityUrl(state.board))}">Board source</a>` : "";
	const empty =
		projection.items.length === 0
			? '<p class="empty">No identified work is declared here. Keep reading ordinary files, or add item IDs and explicit board membership in their Markdown sources.</p>'
			: "";
	const detail = yield* workDetail(projection, state, snapshot);
	return {
		html: `<header class="work-head">${state.view === "now" ? "" : `<p class="work-eyebrow">WORK · ${state.view.toUpperCase()} VIEW</p>`}<h1>${escapeHtml(projection.title)}</h1>${source}</header>
 ${tools}${state.view === "now" ? "<p>Fleet is unavailable in this source fallback. Lanes use authored status.</p>" : ""}${issues}${state.view === "now" ? "" : `<p class="work-total" role="status">${shown} shown · ${total} items in this view</p>`}
 <div class="work-layout${state.item ? " has-detail" : ""}"><section id="work-results" tabindex="-1" aria-label="Work items">${empty}${state.view === "table" ? workTable(projection.rows, state, waiting) : workCards(projection.rows, state, waiting)}</section>${detail}</div>`,
		status: 200,
	};
});
