import process from "node:process";
import { Layer, Logger } from "effect";
import { HttpServer } from "effect/http";
import { makePlatformRuntime } from "#runtime/make.ts";
import { ping } from "#test/app-host/ping.ts";
import { emptyHost } from "#test/app-host/state.ts";
import { otlpHost } from "#test/otlpHost.ts";

const DEVELOPMENT_CACHE_KEY = "production-runtime-test";
const first = makePlatformRuntime(otlpHost(emptyHost()).pipe(Layer.provideMerge(Logger.layer([]))), { developmentCacheKey: DEVELOPMENT_CACHE_KEY });
const second = makePlatformRuntime(otlpHost(emptyHost()).pipe(Layer.provideMerge(Logger.layer([]))), { developmentCacheKey: DEVELOPMENT_CACHE_KEY });
try {
	for (const runtime of [first, second]) {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		if ((await ping(`${HttpServer.formatAddress(server.address)}/rpc`)) !== "pong") {
			throw new Error("The production host did not answer RPC");
		}
	}
	process.stdout.write(first === second ? "shared" : "distinct");
} finally {
	await first.dispose();
	await second.dispose();
}
