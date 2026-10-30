import { Context, Effect, Layer } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";
import { recordLifetime } from "./lifetimeLog.ts";

export class OrderLabel extends Context.Service<OrderLabel, string>()("composition/OrderLabel") {}

export const orders = storyKit({
	after: { ordered: () => recordLifetime("orders after") },
	around: (effect) =>
		Effect.gen(function* () {
			yield* recordLifetime("orders around");
			return yield* effect;
		}),
	*create() {
		yield* recordLifetime("orders create");
		const service = yield* fakeHttpService({ routes: { order: { path: "/order", reply: () => ({ status: HttpStatus.fromLiteral("NotFound") }) } } });
		return { orders: { service } };
	},
	layer: Layer.succeed(OrderLabel, "a loaf of rye"),
	name: "orders",
	stages: ["ordered"],
	verbs: (engine, story) => ({
		orders: {
			read: () =>
				Effect.tryPromise(async () => {
					story.tell("read the order");
					return (await fetch(`${engine.orders.service.url}/order`)).text();
				}),
		},
	}),
});

export const loafOrdered = orders.trait("ordered", "a loaf is ordered", function* (engine) {
	yield* recordLifetime("orders trait");
	yield* engine.orders.service.replyOnce("order", { body: Buffer.from(yield* OrderLabel) });
});
