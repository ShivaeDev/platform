import { Option } from "effect";
import { useQuery } from "#client/resultState.ts";
import type { connect } from "#test/compared-postgres/connect.ts";

export function Notes({ client, name = "list" }: { readonly client: ReturnType<typeof connect>; readonly name?: "list" | "independent" }) {
	const query = useQuery(client.api[name].query(undefined));
	if (query.denied) {
		return <output>Read denied</output>;
	}
	return (
		<output>
			{Option.getOrUndefined(query.data)
				?.map((note) => note.title)
				.join(", ") ?? "Loading"}
		</output>
	);
}
