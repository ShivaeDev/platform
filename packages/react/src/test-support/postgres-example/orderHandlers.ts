import { Effect, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { readKeys } from "@shivaedev/contract/keys.ts";
import { Identity } from "@shivaedev/identity/identity.ts";
import { AppChanges } from "@shivaedev/server/appHost.ts";
import { ApplicationOrders, type Order, orders, type Rejected } from "./contract.ts";
import { OrderService } from "./OrderService.ts";

export function orderHandlers(read: () => Promise<readonly Pick<Order, "name" | "quantity">[]>, beforeCommit?: Effect.Effect<void, Rejected>) {
	const publications: string[] = [];
	const delivered: Array<readonly Pick<Order, "name" | "quantity">[]> = [];
	const reads: number[] = [];
	const handlers = ApplicationOrders.toLayer(
		Effect.gen(function* () {
			const service = yield* OrderService;
			const reactivity = yield* Reactivity.Reactivity;
			const live = yield* AppChanges;
			yield* Effect.acquireRelease(
				Effect.sync(() => reactivity.registerUnsafe(readKeys([orders.item(1)]), () => publications.push("orders:1"))),
				(cancel) => Effect.sync(cancel),
			);
			function observe() {
				return Effect.gen(function* () {
					const rows = yield* Effect.promise(read);
					delivered.push(rows);
				});
			}
			return ApplicationOrders.of({
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
							yield* observe();
							return live.stream([orders.item(id)]).pipe(Stream.tap((hint) => (hint._tag === "Changed" ? observe() : Effect.void)));
						}),
					),
			});
		}),
	);
	return { delivered, handlers, publications, reads };
}
