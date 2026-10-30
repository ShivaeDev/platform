import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { readRuntimeValue } from "./runtime.ts";
import { recreatedDevelopmentRuntime, sharedDevelopmentRuntime } from "./runtimeCaching.ts";
import { runtimeCases } from "./runtimeCases.ts";
import type { HostState } from "./state.ts";

function json(evaluate: () => Promise<unknown>) {
	return Effect.promise(async () => HttpServerResponse.jsonUnsafe(await evaluate()));
}

export function runtimeRoutes(state: HostState) {
	const cases = runtimeCases(state);
	return Layer.mergeAll(
		HttpRouter.add("GET", "/runtime/value", (incoming) =>
			Effect.promise(async () => {
				const params = new URL(incoming.url, "http://localhost").searchParams;
				return HttpServerResponse.text(await readRuntimeValue(state, params.get("override") ?? undefined, params.get("context") === "true"));
			}),
		),
		HttpRouter.add("GET", "/runtime/exit", json(cases.exit)),
		HttpRouter.add("GET", "/runtime/failure", json(cases.failure)),
		HttpRouter.add("GET", "/runtime/layer-failure", json(cases.layerFailure)),
		HttpRouter.add("GET", "/runtime/nested", json(cases.nested)),
		HttpRouter.add(
			"GET",
			"/runtime/recreation",
			json(() => recreatedDevelopmentRuntime(state)),
		),
		HttpRouter.add("GET", "/runtime/cancellation", (incoming) =>
			json(() => cases.cancellation(new URL(incoming.url, "http://localhost").searchParams.get("run") ?? "runPromise")),
		),
		HttpRouter.add(
			"GET",
			"/runtime/development",
			Effect.promise(async () => HttpServerResponse.text(await sharedDevelopmentRuntime(state))),
		),
	);
}
