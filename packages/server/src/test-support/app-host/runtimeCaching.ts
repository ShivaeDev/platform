import { Layer } from "effect";
import { HttpServer } from "effect/http";
import { makePlatformRuntime } from "#runtime/makePlatform.ts";
import type { PlatformRuntime } from "#runtime/types.ts";
import { ping } from "./ping.ts";
import { RuntimeValue, runtimeLayer } from "./runtimeLayer.ts";
import type { HostState } from "./state.ts";

async function listening(runtime: Pick<PlatformRuntime<HttpServer.HttpServer, unknown>, "runPromise">) {
	const server = await runtime.runPromise(HttpServer.HttpServer);
	if ((await ping(`${HttpServer.formatAddress(server.address)}/rpc`)) !== "pong") {
		throw new Error("A cached host did not answer RPC");
	}
}
export async function sharedDevelopmentRuntime(state: HostState) {
	const key = Symbol("runtime-test");
	const layer = state.build(state);
	const first = makePlatformRuntime(layer, { developmentCacheKey: key });
	const second = makePlatformRuntime(layer, { developmentCacheKey: key });
	try {
		await listening(first);
		await listening(second);
		return first === second ? "shared" : "distinct";
	} finally {
		await first.dispose();
		if (first !== second) {
			await second.dispose();
		}
	}
}
export async function recreatedDevelopmentRuntime(state: HostState) {
	const lifecycle: string[] = [];
	const layer = state.build(state).pipe(Layer.provideMerge(runtimeLayer(lifecycle)));
	const options = { developmentCacheKey: Symbol("runtime-recreation") };
	const first = makePlatformRuntime(layer, options);
	state.cleanup.push(first.dispose);
	await listening(first);
	await first.dispose();
	const second = makePlatformRuntime(layer, options);
	try {
		const fresh = second !== first;
		const cached = makePlatformRuntime(layer, options) === second;
		await first.dispose();
		const retained = makePlatformRuntime(layer, options) === second;
		await listening(second);
		const value = await second.runPromise(RuntimeValue);
		const before = [...lifecycle];
		await second.dispose();
		return {
			"after disposing the cached runtime": fresh ? "a fresh runtime" : "the disposed runtime",
			"application layer": { "after disposal": lifecycle, "while cached": before },
			"next lookup": cached ? "the fresh runtime" : "another runtime",
			"value": value,
			"when the old runtime is disposed again": retained ? "the fresh runtime stays cached" : "the fresh runtime is evicted",
		};
	} finally {
		await second.dispose();
	}
}
