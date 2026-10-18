import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { BoardTestApi } from "#test/react.tsx";
export function QuerySearchResults({ api }: { readonly api: BoardTestApi }) {
	const query = useQuery(api.search.query({ query: "Morning walk" }));
	return (
		<output>{Option.match(query.data, { onNone: () => "Loading", onSome: ({ results }) => results.map((entry) => entry.text).join("; ") })}</output>
	);
}
