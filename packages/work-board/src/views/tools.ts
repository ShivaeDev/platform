import { escapeHtml } from "#page/escape.ts";
import { type State, viewUrl } from "./state.ts";

export function viewTools(state: State): string {
	const layouts = ["board", "table"] as const;
	return `<nav class="view-layouts" aria-label="Work layout">${layouts.map((view) => `<a href="${escapeHtml(viewUrl(state, { view }, "work-results"))}"${state.view === view ? ' aria-current="page"' : ""}>${view === "board" ? "Board" : "Table"}</a>`).join("")}</nav>
 <section id="saved-work-views" class="saved-work-views" aria-label="Saved local views" data-url="${escapeHtml(viewUrl(state, { item: "" }))}">
 <form id="save-work-view"><label for="view-name">View name</label><input id="view-name" maxlength="60" placeholder="Name this view" required><button type="submit" disabled>Save view</button></form>
 <div class="view-picker"><label for="saved-view">Saved views</label><select id="saved-view" disabled><option value="">No saved views</option></select><a id="open-saved-view" hidden>Open</a><button id="remove-saved-view" type="button" disabled>Remove</button><button id="clear-saved-views" type="button" disabled>Clear all</button></div>
 <p id="saved-view-status" role="status">Save board, filters, sort, and layout locally. Item selection stays in the URL. Saving requires JavaScript.</p></section>`;
}
