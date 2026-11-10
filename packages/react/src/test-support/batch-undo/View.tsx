import { RegistryContext } from "@effect/atom-react";
import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { StrictMode } from "react";
import type { deployUpdate } from "#client/deployUpdate.ts";
import { useAction, useQuery } from "#client/resultState.ts";
import { useUndoableChange } from "#client/useUndoableChange.ts";
import type { Client } from "#test/batch-undo/client.ts";

export interface Props {
	readonly client: Client;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly scale: number;
	readonly update: Pick<ReturnType<typeof deployUpdate>, "block">;
}

function Panel({ client, scale, update }: Props) {
	const list = useQuery(client.api.list.query());
	const rows = Option.getOrElse(list.data, () => []);
	const change = useUndoableChange(
		{ ...client.api.change, runtime: client.runtime, update },
		{
			describe: (saved) => `Changed ${saved.undo.length} rows`,
			undoInput: (saved) => ({ _tag: "undo" as const, token: saved.undo }),
		},
	);
	const edit = useAction(client.runtime, client.api.change.run);
	const error = AsyncResult.isFailure(change.undoResult) ? Option.getOrUndefined(Cause.findErrorOption(change.undoResult.cause)) : undefined;
	const failure = error?._tag === "Conflict" ? `${error._tag}: ${error.message}` : error?._tag;
	function apply(copies: boolean) {
		change.remove({ _tag: "edit", copies, rows: rows.map((row) => ({ expectedVersion: row.version, id: row.id })), scale });
	}
	return (
		<>
			<output data-rows="">{rows.map((row) => `${row.id}: ${row.portion} @${row.version}`).join(", ")}</output>
			<button onClick={list.refresh} type="button">
				Refresh rows
			</button>
			<button disabled={change.pending} onClick={() => apply(false)} type="button">
				Scale portions
			</button>
			<button disabled={change.pending} onClick={() => apply(true)} type="button">
				Scale and copy
			</button>
			{rows.map((row) => (
				<button
					key={row.id}
					onClick={() => edit.dispatch({ _tag: "edit", copies: false, rows: [{ expectedVersion: row.version, id: row.id }], scale: 2 })}
					type="button"
				>
					Edit {row.id}
				</button>
			))}
			<output data-notice="">{Option.getOrUndefined(change.notice)?.message ?? ""}</output>
			<button disabled={change.pending} onClick={change.undo} type="button">
				Undo
			</button>
			<output data-failure="">{failure}</output>
			<output data-loading={list.pending || change.pending || edit.pending} />
		</>
	);
}

export function View(props: Props) {
	return (
		<StrictMode>
			<RegistryContext.Provider value={props.registry}>
				<Panel {...props} />
			</RegistryContext.Provider>
		</StrictMode>
	);
}
