import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { useQuery } from "#client/resultState.ts";
import type { connect } from "./connect.ts";

export function Read({ client, id }: { readonly client: ReturnType<typeof connect>; readonly id: number }) {
	const query = useQuery(client.api.get.query({ id }));
	return (
		<output data-note={id} data-pending={query.pending}>
			{Option.getOrUndefined(query.data)?.title ?? "Loading"}
		</output>
	);
}
export function Notes({ client }: { readonly client: ReturnType<typeof connect> }) {
	const status = useAtomValue(client.api[LiveConnection].status);
	return (
		<section data-live={status.connection}>
			<Read client={client} id={1} />
			<Read client={client} id={2} />
		</section>
	);
}
