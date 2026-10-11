import { Effect, Stream } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { readKeys } from "@shivaedev/effect-contract/keys.ts";
import type { LiveHint } from "@shivaedev/effect-contract/live.ts";
import { Identity } from "@shivaedev/platform/rpc/identity.ts";
import { LiveOrders, type Order, orders, type Rejected } from "./contract.ts";
import { OrderService } from "./OrderService.ts";

export function orderHandlers(read: () => Promise<readonly Pick<Order, "name" | "quantity">[]>, beforeCommit?: Effect.Effect<void, Rejected>) {
	const publications: string[] = [];
	const delivered: Array<readonly Pick<Order, "name" | "quantity">[]> = [];
	const reads: number[] = [];
	const handlers = LiveOrders.toLayer(
		Effect.gen(function* () {
			const service = yield* OrderService;
			const reactivity = yield* Reactivity.Reactivity;
			yield* Effect.acquireRelease(
				Effect.sync(() => reactivity.registerUnsafe(readKeys([orders.item(1)]), () => publications.push("orders:1"))),
				(cancel) => Effect.sync(cancel),
			);
			function observe(id: number) {
				return Effect.gen(function* () {
					const rows = yield* Effect.promise(read);
					delivered.push(rows);
					return { _tag: "Changed", keys: [orders.item(id)] } satisfies LiveHint;
				});
			}
			return LiveOrders.of({
				"orders.get": ({ id }) =>
					Effect.gen(function* () {
						reads.push(id);
						return yield* service.get((yield* Identity).id, id);
					}),
				"orders.save": (input) => Effect.flatMap(Identity, ({ id }) => service.save(id, input, beforeCommit)),
				subscribe: ({ id }) =>
					Stream.unwrap(
						Effect.gen(function* () {
							yield* service.get((yield* Identity).id, id);
							return Reactivity.stream(observe(id), readKeys([orders.item(id)]));
						}),
					),
			});
		}),
	);
	return { delivered, handlers, publications, reads };
}
