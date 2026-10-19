import type { State } from "#browser/views/state.ts";
import { viewUrl } from "#browser/views/state.ts";
import { LinkButton } from "#client/react/LinkButton.tsx";

export function WorkTools({ state }: { readonly state: State }) {
	return (
		<nav aria-label="Work layout" className="view-layouts mb-4 flex flex-wrap gap-2">
			{(["now", "board", "table"] as const).map((view) => (
				<LinkButton
					aria-current={state.view === view ? "page" : undefined}
					href={viewUrl(state, { view }, "work-results")}
					key={view}
					variant={state.view === view ? "secondary" : "outline"}
				>
					{{ board: "All work", now: "Now", table: "Table" }[view]}
				</LinkButton>
			))}
		</nav>
	);
}
