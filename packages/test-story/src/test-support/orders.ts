import { Context, Effect, Layer, Scope } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";
import { recordComposition } from "./compositionLifetime.ts";

export class OrderLabel extends Context.Service<OrderLabel, string>()("composition/OrderLabel") {}

export const orders = storyKit({
	after: { ordered: () => recordComposition("orders after") },
	around: (effect) =>
		Effect.gen(function* () {
			yield* recordComposition("orders around");
			return yield* effect;
		}),
	*create() {
		yield* recordComposition("orders create");
		const service = yield* fakeHttpService({ routes: { order: { path: "/order", reply: () => ({ status: HttpStatus.fromLiteral("NotFound") }) } } });
		const traitEngine: unknown = undefined;
		return { orders: { scope: yield* Scope.Scope, service, traitEngine } };
	},
	layer: Layer.succeed(OrderLabel, "a loaf of rye"),
	name: "orders",
	stages: ["ordered"],
	verbs: (engine, story) => ({
		orders: {
			engine: () => engine,
			read: () =>
				Effect.tryPromise(async () => {
					story.tell("read the order");
					return (await fetch(`${engine.orders.service.url}/order`)).text();
				}),
		},
	}),
});

export const loafOrdered = orders.trait("ordered", "a loaf is ordered", function* (engine) {
	yield* recordComposition("orders trait");
	engine.orders.traitEngine = engine;
	yield* engine.orders.service.scriptFault("order", { kind: "status", reply: { body: Buffer.from(yield* OrderLabel) } });
});
