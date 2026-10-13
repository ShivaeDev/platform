import type { State } from "#browser/views/state.ts";
import { viewUrl } from "#browser/views/state.ts";
import { shellIds } from "./shellIds.ts";
export function WorkTools({ state }: { readonly state: State }) {
	return (
		<>
			<nav aria-label="Work layout" className="view-layouts">
				{(["board", "table"] as const).map((view) => (
					<a aria-current={state.view === view ? "page" : undefined} href={viewUrl(state, { view }, "work-results")} key={view}>
						{view === "board" ? "Board" : "Table"}
					</a>
				))}
			</nav>
			<section aria-label="Saved local views" className="saved-work-views" data-url={viewUrl(state, { item: "" })} id={shellIds.savedWorkViews}>
				<form id={shellIds.saveWorkView}>
					<label htmlFor={shellIds.viewName}>View name</label>
					<input id={shellIds.viewName} maxLength={60} placeholder="Name this view" required />
					<button disabled type="submit">
						Save view
					</button>
				</form>
				<div className="view-picker">
					<label htmlFor={shellIds.savedView}>Saved views</label>
					<select disabled id={shellIds.savedView}>
						<option value="">No saved views</option>
					</select>
					<a hidden href="/_board/work" id={shellIds.openSavedView}>
						Open
					</a>
					<button disabled id={shellIds.removeSavedView} type="button">
						Remove
					</button>
					<button disabled id={shellIds.clearSavedViews} type="button">
						Clear all
					</button>
				</div>
				<p id={shellIds.savedViewStatus} role="status">
					Save board, filters, sort, and layout locally. Item selection stays in the URL. Saving requires JavaScript.
				</p>
			</section>
		</>
	);
}
