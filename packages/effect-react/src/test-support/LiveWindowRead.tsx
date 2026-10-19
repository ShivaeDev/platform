import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";

export function LiveWindowRead({ query }: { readonly query: Atom.Atom<AsyncResult.AsyncResult<number>> }) {
	return <output>{AsyncResult.getOrElse(useAtomValue(query), () => 0)}</output>;
}
