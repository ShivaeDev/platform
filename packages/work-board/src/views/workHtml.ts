import { Effect } from "effect";
import { identityUrl } from "#metadata/links.ts";
import { escapeHtml } from "#page/escape.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { projectItems } from "./projection.ts";
import type { State } from "./state.ts";
import { workCards } from "./workCards.ts";
import { workControls } from "./workControls.ts";
import { workDetail } from "./workDetail.ts";

export const workHtml = Effect.fn("WorkBoard.workHtml")(function* (snapshot: Snapshot, state: State) {
	const projection = projectItems(snapshot, state);
	const controls = workControls(projection, state);
	if (!projection.validBoard) {
		return {
			html: `<h1>Board unavailable</h1>${controls}<p class="empty">${escapeHtml(state.board)} is missing, has a duplicate ID, or is not a declared board. Choose another board or open its <a href="${escapeHtml(identityUrl(state.board))}">source identity</a>.</p>`,
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
		html: `<header class="work-head"><p class="work-eyebrow">WORK · BOARD VIEW</p><h1>${escapeHtml(projection.title)}</h1><p>Columns show recorded status. A section heading does not set an item's status.</p>${source}</header>
 ${controls}${issues}<p class="work-total" role="status">${projection.rows.length} shown · ${projection.items.length} items in this view</p>
 <div class="work-layout${state.item ? " has-detail" : ""}"><section id="work-results" tabindex="-1" aria-label="Work items">${empty}${workCards(projection.rows, state)}</section>${detail}</div>`,
		status: 200,
	};
});
