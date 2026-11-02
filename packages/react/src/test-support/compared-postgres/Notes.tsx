import { Option } from "effect";
import { useQuery } from "#client/resultState.ts";
import type { connect } from "./connect.ts";

export function Notes({ client }: { readonly client: ReturnType<typeof connect> }) {
	const query = useQuery(client.api.list.query(undefined));
	return (
		<output>
			{Option.getOrUndefined(query.data)
				?.map((note) => note.title)
				.join(", ") ?? "Loading"}
		</output>
	);
}
