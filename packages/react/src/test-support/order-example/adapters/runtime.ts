import { Effect } from "effect";
import { Orders, type SaveOrderInput } from "#test/order-example/contract.ts";
import { OrderService } from "#test/order-example/service.ts";

export interface OrderServerOptions {
	readonly beforeGet?: (id: number) => Effect.Effect<void>;
	readonly beforeSave?: (input: SaveOrderInput) => Effect.Effect<void>;
}

export function orderHandlers(options: OrderServerOptions = {}) {
	return Orders.application.toLayer({
		"orders.get": ({ id }) =>
			Effect.gen(function* () {
				const orders = yield* OrderService;
				if (options.beforeGet) {
					yield* options.beforeGet(id);
				}
				return yield* orders.get(id);
			}),
		"orders.list": () => OrderService.use((orders) => orders.list()),
		"orders.save": (input) =>
			Effect.gen(function* () {
				const orders = yield* OrderService;
				if (options.beforeSave) {
					yield* options.beforeSave(input);
				}
				return yield* orders.save(input);
			}),
	});
}
