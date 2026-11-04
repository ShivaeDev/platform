import { Deferred, Effect, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";

const Row = Schema.Struct({ id: Schema.String, removed: Schema.Boolean, version: Schema.Number });
const rowsKey = collection("undoable-rows", Schema.String);
const Change = command("change", {
	invalidates: () => [rowsKey.list],
	payload: { expectedVersion: Schema.Number, id: Schema.String, removed: Schema.Boolean },
	rejections: { Conflict },
	success: Row,
});
const List = query("list", { readPolicy: () => Effect.succeed(true), reads: () => [rowsKey.list], success: Schema.Array(Row) });
const Rows = contract("undoableRows", { commands: [Change], queries: [List] });

export function changeClient() {
	const rows = new Map(["first", "second"].map((id) => [id, { id, removed: false, version: 7 }]));
	const held = new Map<string, { arrived: Deferred.Deferred<void>; gate: Deferred.Deferred<void>; finished: Deferred.Deferred<void> }>();
	function hold(id: string, removed: boolean) {
		const key = `${id}:${removed}`;
		let pending = held.get(key);
		if (pending === undefined) {
			pending = { arrived: Deferred.makeUnsafe(), finished: Deferred.makeUnsafe(), gate: Deferred.makeUnsafe() };
			held.set(key, pending);
		}
		return pending;
	}
	const handlers = Rows.toLayer({
		"undoableRows.$changes": () => Stream.never,
		"undoableRows.change": (input) => {
			const pending = hold(input.id, input.removed);
			return Effect.gen(function* () {
				Deferred.doneUnsafe(pending.arrived, Effect.void);
				const row = rows.get(input.id);
				if (row === undefined || row.version !== input.expectedVersion) {
					return yield* Change.reject.Conflict({ message: "The row has a later edit" });
				}
				const changed = { id: input.id, removed: input.removed, version: row.version + 1 };
				rows.set(input.id, changed);
				yield* Deferred.await(pending.gate);
				return changed;
			}).pipe(Effect.ensuring(Effect.sync(() => Deferred.doneUnsafe(pending.finished, Effect.void))));
		},
		"undoableRows.list": () => Effect.sync(() => [...rows.values()]),
	});
	class Client extends AtomRpc.Service<Client>()("@shivaedev/react/test/UndoableChange", {
		group: Rows,
		makeEffect: RpcTest.makeClient(Rows, { flatten: true }),
		protocol: handlers,
	}) {}
	return {
		api: bind(Rows, Client, { live: false }),
		forget: (id: string, removed: boolean) => held.delete(`${id}:${removed}`),
		hold,
		runtime: Client.runtime,
	};
}
export type ChangeClient = ReturnType<typeof changeClient>;
