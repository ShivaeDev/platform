import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { host } from "./story.ts";

export const timedExports = host.trait("configured", "HTTP requests create named export batches", (state) => {
	state.routes = HttpRouter.add("GET", "/trace/:name", (incoming) => {
		const name = new URL(incoming.url, "http://localhost").pathname.split("/").at(-1) ?? "export";
		return Effect.void.pipe(Effect.withSpan(name), Effect.as(HttpServerResponse.text(name)));
	});
});
