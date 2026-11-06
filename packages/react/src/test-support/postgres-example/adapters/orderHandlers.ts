import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { type Order, Orders, orders } from "#test/postgres-example/contract.ts";
import { OrderService } from "#test/postgres-example/service.ts";

export function orderHandlers(read: () => Promise<readonly Pick<Order, "name" | "quantity">[]>) {
	const publications: string[] = [];
	const delivered: Array<readonly Pick<Order, "name" | "quantity">[]> = [];
	const reads: number[] = [];
	const handlers = Orders.application.toLayer(
		Effect.gen(function* () {
			const reactivity = yield* Reactivity.Reactivity;
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
			return Orders.application.of({
				"orders.get": ({ id }) =>
					Effect.gen(function* () {
						reads.push(id);
						yield* observe();
						return yield* OrderService.use((service) => service.get(id));
					}),
				"orders.save": (input) => OrderService.use((service) => service.save(input)),
			});
		}),
	);
	return { delivered, handlers, publications, reads };
}
