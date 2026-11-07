import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { Metrics } from "#modules/notes/client/admin/Metrics.tsx";
import type { AdminClient } from "#modules/notes/client/admin/make.ts";
import { QueryPanel } from "#modules/notes/client/admin/QueryPanel.tsx";

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
