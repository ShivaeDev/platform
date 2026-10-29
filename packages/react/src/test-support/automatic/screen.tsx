import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { useState } from "react";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { useAction, useQuery } from "#client/resultState.ts";
import type { connect } from "./connect.ts";

export function Read({ client, id }: { readonly client: ReturnType<typeof connect>; readonly id: number }) {
	const query = useQuery((id === 1 ? client.api : client.preview).get.query({ id }));
	return (
		<output data-note={id} data-pending={query.pending}>
			{Option.getOrUndefined(query.data)?.title ?? "Loading"}
		</output>
	);
}
export function Notes({ client }: { readonly client: ReturnType<typeof connect> }) {
	const status = useAtomValue(client.api[LiveConnection].status);
	const [second, showSecond] = useState(true);
	const [title, setTitle] = useState("");
	const action = useAction(client.runtime, client.api.rename.run);
	const secondRead = second ? <Read client={client} id={2} /> : null;
	const connectionLabel = status.connection === "reconnecting" ? "Reconnecting" : status.connection;
	const toggleLabel = second ? "Hide second" : "Show second";
	return (
		<section data-live={status.connection}>
			<Read client={client} id={1} />
			{secondRead}
			<p role="status">{connectionLabel}</p>
			<button onClick={() => showSecond(!second)} type="button">
				{toggleLabel}
			</button>
			<input aria-label="Title" onChange={(event) => setTitle(event.target.value)} value={title} />
			<button onClick={() => action.dispatch({ id: 1, title })} type="button">
				Rename
			</button>
		</section>
	);
}
