import { Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useQuery } from "#client/resultState.ts";

export function LiveNote({ atom }: { readonly atom: Atom.Atom<AsyncResult.AsyncResult<{ readonly title: string }, unknown>> }) {
	const query = useQuery(atom);
	return <h1>{Option.match(query.data, { onNone: () => "Loading", onSome: (note) => note.title })}</h1>;
}
