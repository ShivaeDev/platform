import type { State } from "#browser/views/state.ts";
import { viewUrl } from "#browser/views/state.ts";
import { SavedViews } from "./SavedViews.tsx";
export function WorkTools({ state }: { readonly state: State }) {
	return (
		<>
			<nav aria-label="Work layout" className="view-layouts">
				{(["now", "board", "table"] as const).map((view) => (
					<a aria-current={state.view === view ? "page" : undefined} href={viewUrl(state, { view }, "work-results")} key={view}>
						{{ board: "All work", now: "Now", table: "Table" }[view]}
					</a>
				))}
			</nav>
			<SavedViews url={viewUrl(state, { item: "" })} />
		</>
	);
}
