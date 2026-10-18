import { Deferred, Effect, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";

export class ToggleRejected extends Schema.TaggedError<ToggleRejected>()("ToggleRejected", { reason: Schema.String }) {}
const items = collection("items", Schema.Number);
const Row = Schema.Struct({ enabled: Schema.Boolean, id: Schema.Number });
const List = query("list", { reads: () => [items.list], success: Schema.Array(Row) });
const Count = query("count", { reads: () => [items.list], success: Schema.Number });
const Toggle = command("toggle", {
	invalidates: ({ id }) => [items.item(id)],
	payload: Row,
	rejections: { ToggleRejected },
});
const Items = contract("items", { commands: [Toggle], queries: [List, Count] });

export function pendingCommandClient(ids: readonly number[] = [1]) {
	const commandGates = new Map(ids.map((id) => [id, Effect.runSync(Deferred.make<void, ToggleRejected>())]));
	function commandGate(id: number) {
		const gate = commandGates.get(id);
		if (!gate) {
			throw new Error(`No command response for row ${id}`);
		}
		return gate;
	}
	const listGate = Effect.runSync(Deferred.make<boolean>());
	const countGate = Effect.runSync(Deferred.make<number>());
	let written = false;
	function toggle({ id }: typeof Row.Type) {
		return Deferred.await(commandGate(id)).pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					written = true;
				}),
			),
		);
	}
	const handlers = Items.toLayer(
		Effect.succeed(
			Items.of({
				"items.count": () => (written ? Deferred.await(countGate) : Effect.succeed(0)),
				"items.list": () =>
					(written ? Deferred.await(listGate) : Effect.succeed(false)).pipe(Effect.map((enabled) => ids.map((id) => ({ enabled, id })))),
				"items.toggle": toggle,
			}),
		),
	);
	class Client extends AtomRpc.Service<Client>()("test/PendingCommand", {
		group: Items,
		makeEffect: RpcTest.makeClient(Items, { flatten: true }),
		protocol: handlers,
	}) {}
	const api = bind(Items, Client);
	const toggles = Atom.family((id: number) => Client.runtime.fn((input: { readonly enabled: boolean }) => api.toggle.run({ id, ...input })));
	return { command: toggles, commandGate, count: api.count.query(), countGate, list: api.list.query(), listGate };
}
export type PendingClient = ReturnType<typeof pendingCommandClient>;
