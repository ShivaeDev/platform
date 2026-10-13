import { Clock, Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { Authentication, Orders, Principal, type SaveOrderInput, Unauthorized } from "./contract.ts";
import { OrderService } from "./service.ts";

export interface OrderSession {
	readonly expiresAt: number;
	readonly userId: string;
}

export interface OrderServerOptions {
	readonly beforeGet?: (id: number) => Effect.Effect<void>;
	readonly beforeSave?: (input: SaveOrderInput) => Effect.Effect<void>;
	readonly sessions?: ReadonlyMap<string, OrderSession>;
}

export function orderWebHandler(service: Layer.Layer<typeof OrderService.Identifier, unknown>, options: OrderServerOptions = {}) {
	const sessions =
		options.sessions
		?? new Map([
			["alice-session", { expiresAt: Number.POSITIVE_INFINITY, userId: "alice" }],
			["bob-session", { expiresAt: Number.POSITIVE_INFINITY, userId: "bob" }],
		]);
	const authentication = Layer.succeed(Authentication, (effect, { headers }) =>
		Effect.gen(function* () {
			const authorization = headers.authorization;
			const session = authorization?.startsWith("Bearer ") ? sessions.get(authorization.slice(7)) : undefined;
			const now = yield* Clock.currentTimeMillis;
			if (session === undefined || session.expiresAt <= now) {
				return yield* new Unauthorized();
			}
			return yield* Effect.provideService(effect, Principal, { userId: session.userId });
		}),
	);
	const handlers = Orders.toLayer(
		Effect.gen(function* () {
			const orders = yield* OrderService;
			return Orders.of({
				"orders.get": ({ id }) =>
					Effect.gen(function* () {
						const { userId } = yield* Principal;
						if (options.beforeGet) {
							yield* options.beforeGet(id);
						}
						return yield* orders.get(userId, id);
					}),
				"orders.list": () => Effect.flatMap(Principal, ({ userId }) => orders.list(userId)),
				"orders.save": (input) =>
					Effect.gen(function* () {
						const { userId } = yield* Principal;
						if (options.beforeSave) {
							yield* options.beforeSave(input);
						}
						return yield* orders.save(userId, input);
					}),
			});
		}),
	).pipe(Layer.provide(service));
	return HttpRouter.toWebHandler(
		RpcServer.layerHttp({ group: Orders, path: "/rpc", protocol: "http" }).pipe(
			Layer.provide(handlers),
			Layer.provide(authentication),
			Layer.provide(RpcSerialization.layerJson),
		),
		{ disableLogger: true },
	);
}
