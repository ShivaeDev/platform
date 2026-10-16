import { Agent } from "node:http";
import { ByteSize, Effect, Layer, ManagedRuntime } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import { RpcGroup } from "effect/rpc";
import { expect, it } from "vitest";
import { appHost } from "#appHost.ts";
import { postBody } from "#test/app-host/postBody.ts";
import { readBoundedBody } from "./boundedBody.ts";

it("returns 413 for chunked overflow and preserves bytes and the same HTTP connection", async () => {
	const calls: Buffer[] = [];
	const routes = HttpRouter.add("POST", "/body", (incoming) =>
		Effect.gen(function* () {
			const body = yield* readBoundedBody(incoming);
			calls.push(Buffer.from(body));
			return HttpServerResponse.uint8Array(new Uint8Array(body));
		}).pipe(Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(8))),
	);
	const runtime = ManagedRuntime.make(appHost({ config: { port: 0 }, group: RpcGroup.make(), handlers: Layer.empty, policy: "loopback", routes }));
	const agent = new Agent({ keepAlive: true, maxSockets: 1 });
	try {
		const url = HttpServer.formatAddress((await runtime.runPromise(HttpServer.HttpServer)).address);
		const refused = await postBody(url, agent, [Buffer.alloc(4), Buffer.alloc(5)], { finishAfterResponse: true });
		expect(refused.status).toBe(413);
		expect(calls).toEqual([]);
		const bytes = Buffer.from([0, 255, 195, 169, 128, 13, 10]);
		const accepted = await postBody(url, agent, [bytes.subarray(0, 3), bytes.subarray(3)]);
		expect(accepted.status).toBe(200);
		expect(accepted.reusedSocket).toBe(true);
		expect(accepted.body).toEqual(bytes);
		expect(calls).toEqual([bytes]);
		expect((await postBody(url, agent, [Buffer.alloc(9)], { contentLength: 9 })).status).toBe(413);
		expect(calls).toEqual([bytes]);
	} finally {
		agent.destroy();
		await runtime.dispose();
	}
});

it("rejects an oversized content-length before the client sends the body", async () => {
	const routes = HttpRouter.add("POST", "/body", (incoming) =>
		readBoundedBody(incoming).pipe(Effect.as(HttpServerResponse.empty()), Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(8))),
	);
	const runtime = ManagedRuntime.make(appHost({ config: { port: 0 }, group: RpcGroup.make(), handlers: Layer.empty, policy: "loopback", routes }));
	const agent = new Agent({ keepAlive: true });
	try {
		const url = HttpServer.formatAddress((await runtime.runPromise(HttpServer.HttpServer)).address);
		expect((await postBody(url, agent, [], { contentLength: 9 })).status).toBe(413);
	} finally {
		agent.destroy();
		await runtime.dispose();
	}
});
