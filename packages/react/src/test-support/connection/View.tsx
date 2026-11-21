import type { Effect } from "effect";
import { useState } from "react";
import { QueryView } from "#client/QueryView.ts";
import { useQuery } from "#client/resultState.ts";
import { useConnectionStatus } from "#client/useConnectionStatus.ts";
import type { connect } from "#test/connection/connect.ts";

type Client = Effect.Success<ReturnType<typeof connect>>;
function Note({ client }: Pick<Client, "client">) {
	const note = useQuery(client.api.get.query());
	return (
		<>
			<button onClick={note.refresh} type="button">
				Refresh note
			</button>
			<QueryView
				content={(value) => <output>{value}</output>}
				failure={(error) => <p role="alert">{error.message}</p>}
				loading={() => <output>Loading</output>}
				query={note}
			/>
		</>
	);
}
export function View({ client, summary }: Client) {
	const count = useQuery(summary.get.query());
	const connection = useConnectionStatus(client);
	const [showNote, setShowNote] = useState(true);
	const note = showNote ? <Note client={client} /> : null;
	return (
		<article>
			<button onClick={() => setShowNote(false)} type="button">
				Close note
			</button>
			<p role="status">{connection}</p>
			{note}
			<QueryView
				content={(value) => <output>{value}</output>}
				failure={(error) => <p role="alert">{error.message}</p>}
				loading={() => <output>Loading</output>}
				query={count}
			/>
		</article>
	);
}
