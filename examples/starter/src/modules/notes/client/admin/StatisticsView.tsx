import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import { QueryView } from "@shivaedev/react/client/QueryView.ts";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { Button } from "#client/ui/button.tsx";
import type { StatisticsPage } from "#modules/notes/admin/pages.ts";
import { Metrics } from "#modules/notes/client/admin/Metrics.tsx";

export function NoteStatisticsView({ client }: { readonly client: ContractClient<typeof StatisticsPage.contract> }) {
	const state = useQuery(client.statistics.query());
	return (
		<section aria-label="Note statistics" className="space-y-4">
			<p className="text-muted-foreground">Across all app users. Notes awaiting word counts remain pending until the worker completes.</p>
			<Button disabled={state.pending} onClick={state.refresh} variant="outline">
				Refresh
			</Button>
			<QueryView
				content={(value) => <Metrics values={{ Notes: value.notes, "Pending counts": value.pending, Words: value.words }} />}
				query={state}
			/>
		</section>
	);
}
