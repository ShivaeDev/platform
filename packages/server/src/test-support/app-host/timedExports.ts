import { Clock, Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { host } from "./story.ts";

export const timedExports = host.trait("configured", "HTTP requests create named export batches", function* (state) {
	const clock = yield* Clock.Clock;
	const build = state.build;
	state.build = (hostState) => build(hostState).pipe(Layer.provideMerge(Layer.succeed(Clock.Clock, clock)));
	state.routes = HttpRouter.add("GET", "/trace/:name", (incoming) => {
		const name = new URL(incoming.url, "http://localhost").pathname.split("/").at(-1) ?? "export";
		return Effect.void.pipe(Effect.withSpan(name), Effect.as(HttpServerResponse.text(name)));
	});
});
