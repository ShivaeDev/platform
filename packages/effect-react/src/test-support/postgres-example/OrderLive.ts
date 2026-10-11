import { Context, type Effect, Layer } from "effect";
import { makeLiveServer } from "@shivaedev/effect-contract/makeLiveServer.ts";

export class OrderLive extends Context.Service<OrderLive, Effect.Success<typeof makeLiveServer>>()("postgres-example/Live") {
	static readonly layer = Layer.effect(OrderLive, makeLiveServer);
}
