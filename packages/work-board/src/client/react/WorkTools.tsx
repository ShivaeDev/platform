import type { State } from "#browser/views/state.ts";
import { viewUrl } from "#browser/views/state.ts";
import { Button } from "#client/react/components/ui/button.tsx";
export function WorkTools({ state }: { readonly state: State }) {
	return (
		<nav aria-label="Work layout" className="view-layouts mb-4 flex flex-wrap gap-2">
			{(["now", "board", "table"] as const).map((view) => (
				<Button
					key={view}
					nativeButton={false}
					render={<a aria-current={state.view === view ? "page" : undefined} href={viewUrl(state, { view }, "work-results")} />}
					size="sm"
					variant={state.view === view ? "secondary" : "outline"}
				>
					{{ board: "All work", now: "Now", table: "Table" }[view]}
				</Button>
			))}
		</nav>
	);
}
