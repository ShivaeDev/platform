import { Clock, Context, Effect, Layer } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";
import { recordLifetime } from "./lifetimeLog.ts";

export class StockLabel extends Context.Service<StockLabel, string>()("composition/StockLabel") {}

export const stock = storyKit({
	after: { stocked: () => recordLifetime("stock after") },
	around: (effect) =>
		Effect.gen(function* () {
			yield* recordLifetime("stock around");
			return yield* effect;
		}),
	clock: "live",
	*create() {
		yield* recordLifetime("stock create");
		const service = yield* fakeHttpService({ routes: { stock: { path: "/stock", reply: () => ({ status: HttpStatus.fromLiteral("NotFound") }) } } });
		return { stock: { service } };
	},
	layer: Layer.succeed(StockLabel, "rye flour"),
	name: "stock",
	stages: ["stocked"],
	verbs: (engine, story) => ({
		stock: {
			clock: () => Clock.currentTimeMillis.pipe(Effect.map((millis) => (millis === 0 ? "the test clock at zero" : "the live clock"))),
			read: () =>
				Effect.tryPromise(async () => {
					story.tell("read the stock");
					return (await fetch(`${engine.stock.service.url}/stock`)).text();
				}),
		},
	}),
});

export const flourInStock = stock.trait("stocked", "flour is in stock", function* (engine) {
	yield* recordLifetime("stock trait");
	yield* engine.stock.service.scriptFault("stock", { kind: "status", reply: { body: Buffer.from(yield* StockLabel) } });
});
