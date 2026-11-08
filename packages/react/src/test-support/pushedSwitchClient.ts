import { Deferred, Effect, Exit, Layer, Queue, Schema, Stream } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";

const switches = collection("switches", Schema.Number);
const Get = query("get", { readPolicy: () => Effect.succeed(true), reads: () => [switches.list], success: Schema.Boolean });
const SetSwitch = command("set", { invalidates: () => [switches.list], payload: Schema.Struct({ enabled: Schema.Boolean }) });
const Switch = contract("switch", { commands: [SetSwitch], queries: [Get] });

export function pushedSwitchClient() {
	const held = { finished: Deferred.makeUnsafe<void>(), gate: Deferred.makeUnsafe<void>() };
	const pushes = Effect.runSync(Queue.unbounded<boolean>());
	let stored = false;
	function setSwitch(enabled: boolean) {
		return Deferred.await(held.gate).pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					stored = enabled;
				}),
			),
			Effect.ensuring(Deferred.done(held.finished, Exit.void)),
		);
	}
	const handlers = Switch.toLayer(
		Effect.succeed(
			Switch.of({
				"switch.$changes": () =>
					Stream.fromQueue(pushes).pipe(
						Stream.prepend([false]),
						Stream.map((value) => ({ _tag: "Result" as const, query: "get" as const, queryIndex: 0, value })),
					),
				"switch.get": () => Effect.sync(() => stored),
				"switch.set": ({ enabled }) => setSwitch(enabled),
			}),
		),
	);
	const { api, Client } = makeClient(Switch, {
		protocol: layerMemoryProtocol(Switch).pipe(Layer.provide(handlers)),
		url: "memory://switch",
	});
	return {
		command: held,
		push: (enabled: boolean) => Queue.offer(pushes, enabled),
		query: api.get.query(),
		set: Client.runtime.fn((input: { readonly enabled: boolean }) => api.set.run(input)),
	};
}
export type PushedSwitchClient = ReturnType<typeof pushedSwitchClient>;
