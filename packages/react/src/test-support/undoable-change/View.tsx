import { RegistryContext } from "@effect/atom-react";
import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { StrictMode } from "react";
import { useDeployUpdate } from "#client/adapters/useDeployUpdate.ts";
import type { deployUpdate } from "#client/deployUpdate.ts";
import { useAction, useQuery } from "#client/resultState.ts";
import { useUndoableChange } from "#client/useUndoableChange.ts";
import type { ChangeClient } from "#test/undoable-change/client.ts";

export interface Props {
	readonly client: ChangeClient;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly update: ReturnType<typeof deployUpdate>;
}

function Panel({ client, update }: Props) {
	const list = useQuery(client.api.list.query());
	const change = useUndoableChange({ ...client.api.change, runtime: client.runtime, update }, { describe: (row) => `Removed ${row.id}` });
	const edit = useAction(client.runtime, client.api.change.run);
	const deploy = useDeployUpdate(update);
	const notice = Option.getOrUndefined(change.notice);
	const error = AsyncResult.isFailure(change.undoResult) ? Option.getOrUndefined(Cause.findErrorOption(change.undoResult.cause)) : undefined;
	return (
		<>
			{Option.getOrElse(list.data, () => []).map((row) => (
				<article key={row.id}>
					<p data-row={row.id}>{`${row.id}: ${row.removed ? "removed" : "visible"} @${row.version}`}</p>
					<button
						onClick={() => change.remove({ expectedVersion: row.version, id: row.id, removed: true }, { id: row.id, removed: false })}
						type="button"
					>
						Remove {row.id}
					</button>
					<button onClick={() => edit.dispatch({ expectedVersion: row.version, id: row.id, removed: true })} type="button">
						Edit {row.id}
					</button>
				</article>
			))}
			<output data-notice="">{notice?.message ?? ""}</output>
			<button disabled={change.undoing} onClick={change.undo} type="button">
				Undo
			</button>
			<output data-undo="">{error?._tag ?? ""}</output>
			<output data-status="">
				{JSON.stringify({ blocked: deploy.blocked, pending: change.pending, removing: change.removing, undoing: change.undoing })}
			</output>
			<output data-loading={list.pending || edit.pending} data-version="">
				{deploy.version}
			</output>
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
