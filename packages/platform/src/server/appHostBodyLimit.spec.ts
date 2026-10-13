import { request } from "node:http";
import { ByteSize, Cause, Config, ConfigProvider, Effect, Exit, Layer, ManagedRuntime, Schema } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import { Rpc, RpcGroup } from "effect/rpc";
import { expect, it } from "vitest";
import { appHost } from "#appHost.ts";
import { sessions } from "#test/app-host/fixture.ts";
import { boundedRpcRequest } from "./boundedRpcRequest.ts";

const Api = RpcGroup.make(Rpc.make("echo", { payload: { text: Schema.String }, success: Schema.String }));

function message(text: string, id = "1") {
	return `${JSON.stringify({ _tag: "Request", headers: [], id, payload: { text }, tag: "echo" })}\n`;
}

function post(url: string, body: string, chunked: boolean) {
	return new Promise<{ readonly status: number; readonly body: string }>((resolve, reject) => {
		const outgoing = request(
			`${url}/rpc`,
			{
				headers: { "content-type": "application/ndjson", ...(chunked ? {} : { "content-length": Buffer.byteLength(body) }) },
				method: "POST",
			},
			(response) => {
				let received = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					received += chunk;
				});
				response.on("end", () => resolve({ body: received, status: response.statusCode ?? 0 }));
			},
		);
		outgoing.on("error", reject);
		outgoing.write(body);
		outgoing.end();
	});
}

it.each([
	{ config: undefined, env: {}, limit: 1024 * 1024, name: "the 1 MiB default" },
	{ config: undefined, env: { "MAX_BODY_SIZE": "256" }, limit: 256, name: "the environment limit" },
	{ config: 128, env: { "MAX_BODY_SIZE": "256" }, limit: 128, name: "config overriding the environment" },
	{ config: 2 * 1024 * 1024, env: {}, limit: 2 * 1024 * 1024, name: "config raising the default" },
])("bounds real HTTP NDJSON with $name before any handler runs", async ({ config, env, limit }) => {
	const calls: string[] = [];
	const runtime = ManagedRuntime.make(
		appHost({
			config: { port: 0, ...(config === undefined ? {} : { maxBodySize: config }) },
			group: Api,
			handlers: Api.toLayer({
				echo: ({ text }) =>
					Effect.sync(() => {
						calls.push(text);
						return "accepted";
					}),
			}),
			services: Layer.empty,
			sessions: sessions([]),
		}).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))),
	);
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		const url = HttpServer.formatAddress(server.address);
		const overhead = Buffer.byteLength(message(""));
		const accepted = "é".repeat(Math.floor((limit - overhead) / 2));
		const oversized = message("small") + message("é".repeat(Math.ceil(limit / 2)), "2");
		expect(Buffer.byteLength(message(accepted))).toBeLessThanOrEqual(limit);
		for (const chunked of [false, true]) {
			calls.length = 0;
			const refused = await post(url, oversized, chunked);
			expect(refused.status).toBeGreaterThanOrEqual(400);
			expect(refused.status).toBeLessThan(500);
			expect(calls).toEqual([]);
			const response = await post(url, message(accepted), chunked);
			expect(response.status).toBe(200);
			expect(response.body).toContain("accepted");
			expect(calls).toEqual([accepted]);
		}
	} finally {
		await runtime.dispose();
	}
});

it("the bounded reader retains cached text and array-buffer reads", async () => {
	const routes = HttpRouter.add("POST", "/body", (incoming) => {
		const bounded = boundedRpcRequest(incoming);
		return Effect.gen(function* () {
			const text = yield* bounded.text;
			const bytes = yield* bounded.arrayBuffer;
			return HttpServerResponse.text(`${text}\n${new TextDecoder().decode(bytes)}\n${yield* bounded.text}`);
		}).pipe(Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(128)));
	});
	const runtime = ManagedRuntime.make(
		appHost({
			config: { port: 0 },
			group: Api,
			handlers: Api.toLayer({ echo: () => Effect.succeed("accepted") }),
			policy: "loopback",
			routes,
			services: Layer.empty,
		}),
	);
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		const body = '{"text":"é"}';
		const response = await fetch(`${HttpServer.formatAddress(server.address)}/body`, { body, method: "POST" });
		expect(response.status).toBe(200);
		expect(await response.text()).toBe(`${body}\n${body}\n${body}`);
	} finally {
		await runtime.dispose();
	}
});

it.each([-1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])("rejects invalid byte limits at startup: %s", async (maxBodySize) => {
	for (const source of ["config", "environment"]) {
		const runtime = ManagedRuntime.make(
			appHost({
				config: { port: 0, ...(source === "config" ? { maxBodySize } : {}) },
				group: Api,
				handlers: Api.toLayer({ echo: () => Effect.succeed("accepted") }),
				policy: "loopback",
				services: Layer.empty,
			}).pipe(
				Layer.provide(
					ConfigProvider.layer(ConfigProvider.fromEnv({ env: source === "environment" ? { "MAX_BODY_SIZE": String(maxBodySize) } : {} })),
				),
			),
		);
		try {
			const exit = await runtime.runPromiseExit(HttpServer.HttpServer);
			expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(Config.ConfigError);
		} finally {
			await runtime.dispose();
		}
	}
});
