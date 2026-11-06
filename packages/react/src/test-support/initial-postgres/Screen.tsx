import { Option } from "effect";
import { useQuery } from "#client/resultState.ts";
import type { Query } from "./readouts.ts";

export function Screen({ query: atom }: { readonly query: Query }) {
	const query = useQuery(atom);
	const text = query.denied
		? "Read denied"
		: Option.match(query.data, {
				onNone: () => "Loading",
				onSome: ({ title, revision }) => `${title} (${typeof revision})`,
			});
	return <output>{text}</output>;
}
