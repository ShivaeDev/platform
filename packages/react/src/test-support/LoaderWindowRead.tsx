import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { QueryOptions } from "#client/resultState.ts";
import { useLoaderQuery } from "#client/useLoaderQuery.ts";

export function LoaderWindowRead({
	atom,
	loaded,
	options,
}: {
	readonly atom: Atom.Atom<AsyncResult.AsyncResult<number, unknown>>;
	readonly loaded: number;
	readonly options?: QueryOptions | undefined;
}) {
	const query = useLoaderQuery(atom, loaded, options);
	return <output>{query.data}</output>;
}
