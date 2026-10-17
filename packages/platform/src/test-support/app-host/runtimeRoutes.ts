import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { readRuntimeValue, sharedDevelopmentRuntime } from "./runtime.ts";
import { type HostState, runtimeOf } from "./state.ts";

export function runtimeRoutes(state: HostState) {
	const failure = new Error("application database unavailable");
	return Layer.mergeAll(
		HttpRouter.add("GET", "/runtime/value", (incoming) =>
			Effect.promise(async () => {
				const params = new URL(incoming.url, "http://localhost").searchParams;
				return HttpServerResponse.text(await readRuntimeValue(state, params.get("override") ?? undefined, params.get("context") === "true"));
			}),
		),
		HttpRouter.add(
			"GET",
			"/runtime/failure",
			Effect.promise(async () => {
				try {
					await runtimeOf(state).runPromise(Effect.fail(failure));
				} catch (error) {
					return HttpServerResponse.text(String(error === failure));
				}
				return HttpServerResponse.text("the runtime unexpectedly succeeded", { status: 500 });
			}),
		),
		HttpRouter.add(
			"GET",
			"/runtime/development",
			Effect.promise(async () => HttpServerResponse.text(String(await sharedDevelopmentRuntime(state)))),
		),
	);
}
