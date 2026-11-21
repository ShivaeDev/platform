import { Deferred, Effect, Exit, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";

export class ToggleRejected extends Schema.TaggedError<ToggleRejected>()("ToggleRejected", { reason: Schema.String }) {}
const items = collection("items", Schema.Number);
const Row = Schema.Struct({ enabled: Schema.Boolean, id: Schema.Number });
const List = query("list", { readPolicy: () => Effect.succeed(true), reads: () => [items.list], success: Schema.Array(Row) });
const Count = query("count", { readPolicy: () => Effect.succeed(true), reads: () => [items.list], success: Schema.Number });
const Toggle = command("toggle", {
	invalidates: ({ id }) => [items.item(id)],
	payload: Row,
	rejections: { ToggleRejected },
});
const Items = contract("items", { commands: [Toggle], queries: [List, Count] });

export function pendingCommandClient(ids: readonly number[] = [1]) {
	const commands = new Map(ids.map((id) => [id, { finished: Deferred.makeUnsafe<void>(), gate: Deferred.makeUnsafe<void, ToggleRejected>() }]));
	function commandFor(id: number) {
		const held = commands.get(id);
		if (!held) {
			throw new Error(`No command response for row ${id}`);
		}
		return held;
	}
	const list = { gate: Deferred.makeUnsafe<boolean>(), served: Deferred.makeUnsafe<void>() };
	const count = { gate: Deferred.makeUnsafe<number>(), served: Deferred.makeUnsafe<void>() };
	function refetch<A>(held: { readonly gate: Deferred.Deferred<A>; readonly served: Deferred.Deferred<void> }) {
		return Deferred.await(held.gate).pipe(Effect.ensuring(Deferred.done(held.served, Exit.void)));
	}
	let written = false;
	function toggle({ id }: typeof Row.Type) {
		const held = commandFor(id);
		return Deferred.await(held.gate).pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					written = true;
				}),
			),
			Effect.ensuring(Deferred.done(held.finished, Exit.void)),
		);
	}
	const handlers = Items.application.toLayer(
		Effect.succeed(
			Items.application.of({
				"items.count": () => (written ? refetch(count) : Effect.succeed(0)),
				"items.list": () => (written ? refetch(list) : Effect.succeed(false)).pipe(Effect.map((enabled) => ids.map((id) => ({ enabled, id })))),
				"items.toggle": toggle,
			}),
		),
	);
	const {
		api: { items: api },
	} = makeClient(
		{ items: Items },
		{
			protocol: layerLiveMemoryProtocol(Items, handlers),
			url: "memory://items",
		},
	);
	const listed = api.list.query();
	const counted = api.count.query();
	return {
		command: api.toggle,
		commands: commandFor,
		count: counted,
		countHeld: count,
		list: listed,
		listHeld: list,
	};
}
export type PendingClient = ReturnType<typeof pendingCommandClient>;
