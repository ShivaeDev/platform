import { type Effect, Option } from "effect";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import type { collectionEngine } from "./collectionEngine.ts";

export function CollectionView({ query }: Pick<Effect.Success<typeof collectionEngine>, "query">) {
	const state = useQuery(query);
	if (Option.isSome(state.cause)) {
		return <p>Permission denied</p>;
	}
	return (
		<ul aria-label="Workspaces">
			{Option.getOrElse(state.data, () => []).map((row) => (
				<li key={row.id}>{`${row.tenant}: ${row.title}`}</li>
			))}
		</ul>
	);
}
