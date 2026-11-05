import { Effect, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { LiveServer } from "@shivaedev/contract/live-server/service.ts";
import { ApplicationOrders, type Order, orders } from "#test/postgres-example/contract.ts";
import { OrderService } from "#test/postgres-example/service.ts";

export function orderHandlers(read: () => Promise<readonly Pick<Order, "name" | "quantity">[]>) {
	const publications: string[] = [];
	const delivered: Array<readonly Pick<Order, "name" | "quantity">[]> = [];
	const reads: number[] = [];
	const handlers = ApplicationOrders.toLayer(
		Effect.gen(function* () {
			const reactivity = yield* Reactivity.Reactivity;
			const live = yield* LiveServer;
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
						return yield* OrderService.use((service) => service.get(id));
					}),
				"orders.save": (input) => OrderService.use((service) => service.save(input)),
				subscribe: ({ id }) =>
					Stream.unwrap(
						Effect.gen(function* () {
							yield* OrderService.use((service) => service.get(id));
							yield* observe();
							return Stream.unwrap(live.stream([orders.item(id)])).pipe(Stream.tap((hint) => (hint._tag === "Changed" ? observe() : Effect.void)));
						}),
					),
			});
		}),
	);
	return { delivered, handlers, publications, reads };
}
