import { RegistryContext } from "@effect/atom-react";
import { Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useState } from "react";
import { useDeployUpdate, useUpdateBlocker } from "#client/adapters/useDeployUpdate.ts";
import type { deployUpdate } from "#client/deployUpdate.ts";
import { useQuery } from "#client/resultState.ts";

type Update = ReturnType<typeof deployUpdate<unknown>>;
type Read = Atom.Atom<AsyncResult.AsyncResult<string, unknown>>;

export function Sheet({ update }: { readonly update: Update }) {
	useUpdateBlocker(update, true);
	return <aside>Sheet open</aside>;
}

export function Panel({ update, read }: { readonly update: Update; readonly read: Read }) {
	const [sheet, setSheet] = useState(false);
	const state = useDeployUpdate(update);
	const query = useQuery(read);
	const sheetView = sheet ? <Sheet update={update} /> : null;
	const reload = state.available ? (
		<button onClick={state.reload} type="button">
			Reload application
		</button>
	) : null;
	return (
		<>
			{sheetView}
			<p>{Option.getOrUndefined(query.data)}</p>
			<output data-available={state.available} data-blocked={state.blocked}>
				{state.version ?? "Waiting for host"}
			</output>
			<button onClick={() => setSheet(!sheet)} type="button">
				{sheet ? "Close sheet" : "Open sheet"}
			</button>
			{reload}
		</>
	);
}

export function View({ registry, update, read }: { readonly registry: AtomRegistry.AtomRegistry; readonly update: Update; readonly read: Read }) {
	return (
		<RegistryContext.Provider value={registry}>
			<Panel read={read} update={update} />
		</RegistryContext.Provider>
	);
}
