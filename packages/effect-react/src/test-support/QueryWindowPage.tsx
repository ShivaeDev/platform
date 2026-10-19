import type { Duration } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import { useQuery } from "#client/resultState.ts";

type Query = Atom.Atom<AsyncResult.AsyncResult<number, unknown>>;

export function QueryWindowRead({ atom, name, window }: { readonly atom: Query; readonly name: string; readonly window?: Duration.Input }) {
	const result = useQuery(atom, { coalesceWindow: window });
	return <output aria-label={name}>{result.data._tag === "Some" ? result.data.value : "loading"}</output>;
}

export function QueryWindowPage({ dashboard, detail, inherited }: { readonly dashboard: Query; readonly detail: Query; readonly inherited: Query }) {
	const [window, setWindow] = useState<Duration.Input>("100 millis");
	return (
		<>
			<QueryWindowRead atom={detail} name="detail" window={window} />
			<QueryWindowRead atom={dashboard} name="dashboard" window="2 seconds" />
			<QueryWindowRead atom={inherited} name="inherited" />
			<button onClick={() => setWindow("300 millis")} type="button">
				Slow detail
			</button>
		</>
	);
}
