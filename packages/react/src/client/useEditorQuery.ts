import { Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { FailureChoices } from "#client/failures.ts";
import { useQuery } from "#client/resultState.ts";
import { useLoadedQueryFailures } from "#client/useLoadedQueryFailures.ts";

// The row an editor's form starts from: the query's latest success, or the route's loaded row until the query has one.
export function useEditorQuery(config: {
	readonly loaded?: unknown;
	readonly query: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>;
	readonly queryFailures?: FailureChoices["failures"];
}) {
	const query = useQuery(config.query);
	useLoadedQueryFailures(query.result, query.refresh, { failures: config.queryFailures }, "loaded" in config);
	const row = Option.orElse(query.data, () => ("loaded" in config ? Option.some(config.loaded) : Option.none()));
	return { query, row };
}
