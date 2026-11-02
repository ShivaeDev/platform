import { Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useQuery } from "#client/resultState.ts";

export function Note({ query }: { readonly query: Atom.Atom<AsyncResult.AsyncResult<string, unknown>> }) {
	const result = useQuery(query);
	const content = result.denied ? "Read denied" : Option.getOrUndefined(result.data);
	return <output>{content}</output>;
}
