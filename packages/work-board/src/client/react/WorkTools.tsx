import type { State } from "#browser/views/state.ts";
import { viewUrl } from "#browser/views/state.ts";
import { buttonVariants } from "#client/react/components/ui/buttonVariants.ts";
export function WorkTools({ state }: { readonly state: State }) {
	return (
		<nav aria-label="Work layout" className="view-layouts mb-4 flex flex-wrap gap-2">
			{(["now", "board", "table"] as const).map((view) => (
				<a
					aria-current={state.view === view ? "page" : undefined}
					className={buttonVariants({ size: "sm", variant: state.view === view ? "secondary" : "outline" })}
					href={viewUrl(state, { view }, "work-results")}
					key={view}
				>
					{{ board: "All work", now: "Now", table: "Table" }[view]}
				</a>
			))}
		</nav>
	);
}
