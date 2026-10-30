import { Effect } from "effect";
import { Identity } from "@shivaedev/identity/identity.ts";
import { Orders, type SaveOrderInput } from "./contract.ts";
import { OrderService } from "./service.ts";

export interface OrderServerOptions {
	readonly beforeGet?: (id: number) => Effect.Effect<void>;
	readonly beforeSave?: (input: SaveOrderInput) => Effect.Effect<void>;
}

export function orderHandlers(options: OrderServerOptions = {}) {
	return Orders.application.toLayer(
		Effect.gen(function* () {
			const orders = yield* OrderService;
			return {
				"orders.get": ({ id }) =>
					Effect.gen(function* () {
						const viewer = yield* Identity;
						if (options.beforeGet) {
							yield* options.beforeGet(id);
						}
						return yield* orders.get(viewer.id, id);
					}),
				"orders.list": () => Effect.flatMap(Identity, ({ id }) => orders.list(id)),
				"orders.save": (input) =>
					Effect.gen(function* () {
						const viewer = yield* Identity;
						if (options.beforeSave) {
							yield* options.beforeSave(input);
						}
						return yield* orders.save(viewer.id, input);
					}),
			};
		}),
	);
}
