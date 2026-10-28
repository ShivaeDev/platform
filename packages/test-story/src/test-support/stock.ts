import { Context, Effect, Layer, Scope } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";
import { recordComposition } from "./compositionLifetime.ts";

export class StockLabel extends Context.Service<StockLabel, string>()("composition/StockLabel") {}

export const stock = storyKit({
	after: { stocked: () => recordComposition("stock after") },
	around: (effect) =>
		Effect.gen(function* () {
			yield* recordComposition("stock around");
			return yield* effect;
		}),
	clock: "live",
	*create() {
		yield* recordComposition("stock create");
		const service = yield* fakeHttpService({ routes: { stock: { path: "/stock", reply: () => ({ status: HttpStatus.fromLiteral("NotFound") }) } } });
		const traitEngine: unknown = undefined;
		return { stock: { scope: yield* Scope.Scope, service, traitEngine } };
	},
	layer: Layer.succeed(StockLabel, "rye flour"),
	name: "stock",
	stages: ["stocked"],
	verbs: (engine, story) => ({
		stock: {
			engine: () => engine,
			read: () =>
				Effect.tryPromise(async () => {
					story.tell("read the stock");
					return (await fetch(`${engine.stock.service.url}/stock`)).text();
				}),
		},
	}),
});

export const flourInStock = stock.trait("stocked", "flour is in stock", function* (engine) {
	yield* recordComposition("stock trait");
	engine.stock.traitEngine = engine;
	yield* engine.stock.service.replyOnce("stock", { body: Buffer.from(yield* StockLabel) });
});
