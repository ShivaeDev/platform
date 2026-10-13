import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { RpcSerialization } from "effect/rpc";
import { describe, expect, it } from "vitest";
import { localRpcGuard, loopbackOnly, sameOrigin } from "./local.ts";

describe("transport address", () => {
	it.each([undefined, "203.0.113.9", "127.999.0.1"])("rejects an unknown or non-loopback address: %s", async (address) => {
		let calls = 0;
		const request = HttpServerRequest.fromWeb(
			new Request("http://localhost/rpc", { headers: { "content-type": "application/ndjson", host: "localhost" } }),
		).modify({ remoteAddress: Option.fromNullishOr(address) });
		const response = await Effect.runPromise(
			localRpcGuard(
				Effect.sync(() => {
					calls += 1;
					return HttpServerResponse.empty();
				}),
			).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request), Effect.provide(RpcSerialization.layerNdjson)),
		);
		expect(response.status).toBe(403);
		expect(calls).toBe(0);
	});
	it.each(["127.0.0.2", "::ffff:127.0.0.1", "::1"])("accepts a known loopback address: %s", async (address) => {
		const request = HttpServerRequest.fromWeb(
			new Request("http://localhost/rpc", { headers: { "content-type": "application/ndjson", host: "localhost" } }),
		).modify({ remoteAddress: Option.some(address) });
		const response = await Effect.runPromise(
			localRpcGuard(Effect.succeed(HttpServerResponse.empty())).pipe(
				Effect.provideService(HttpServerRequest.HttpServerRequest, request),
				Effect.provide(RpcSerialization.layerNdjson),
			),
		);
		expect(response.status).toBe(204);
	});
});
it("keeps loopback-only Fetch pages usable without a transport address", async () => {
	const request = HttpServerRequest.fromWeb(new Request("http://localhost/", { headers: { host: "localhost" } }));
	expect((await Effect.runPromise(loopbackOnly(() => Effect.succeed(HttpServerResponse.empty()))(request))).status).toBe(204);
	expect(sameOrigin(request)).toBe(true);
});
