import { useQuery } from "@shivaedev/react/client/resultState.ts";
import type { AdminClient } from "./admin.ts";
import { Metrics } from "./Metrics.tsx";
import { QueryPanel } from "./QueryPanel.tsx";

export function NoteStatisticsView({ client }: { readonly client: AdminClient }) {
	const state = useQuery(client.statistics.statistics.query());
	return (
		<section aria-label="Note statistics" className="space-y-4">
			<p className="text-muted-foreground">Across all app users. Notes awaiting word counts remain pending until the worker completes.</p>
			<QueryPanel state={state}>
				{(value) => <Metrics values={{ Notes: value.notes, "Pending counts": value.pending, Words: value.words }} />}
			</QueryPanel>
		</section>
	);
}
