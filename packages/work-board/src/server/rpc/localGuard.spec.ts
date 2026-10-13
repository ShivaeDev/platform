import { Effect, Layer } from "effect";
import { RpcSerialization } from "effect/rpc";
import { describe, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { localRpcServer } from "#test/localRpcServer.ts";

let server: Effect.Success<ReturnType<typeof localRpcServer>>;

const setupBoard = Effect.gen(function* () {
	server = yield* localRpcServer();
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

describe("local RPC over real HTTP", () => {
	effectApp("runs the handler for a loopback same-origin request without a session provider", function* () {
		const response = yield* Effect.promise(() =>
			server.post({ "content-type": "application/ndjson; charset=utf-8", host: server.host, origin: `http://${server.host}` }),
		);
		expect(response.status).toBe(200);
		expect(response.body).toContain("pong");
		expect(server.calls()).toBe(1);
	});

	effectApp("allows a local client without an Origin", function* () {
		expect((yield* Effect.promise(() => server.post({ "content-type": "application/ndjson", host: server.host }))).status).toBe(200);
		expect(server.calls()).toBe(1);
	});

	effectApp.each(["localhost", "127.0.0.2", "[::1]"])("accepts a loopback Host: %s", function* (host) {
		const response = yield* Effect.promise(() => server.post({ "content-type": "application/ndjson", host, origin: `http://${host}` }));
		expect(response.status).toBe(200);
		expect(server.calls()).toBe(1);
	});

	effectApp.each([
		["foreign Origin", { origin: "http://foreign.example" }],
		["non-loopback Host", { host: "192.0.2.1" }],
		["DNS-rebinding Host on a loopback connection", { host: "rebound.example" }],
		["wrong content type", { "content-type": "application/json" }],
		["missing content type", {}],
		["malformed Origin", { origin: ":invalid:" }],
		["Host with user information", { host: "foreign.example@localhost" }],
		["malformed Host", { host: "[" }],
	] as const)("rejects a %s before the RPC handler runs", function* ([name, headers]) {
		const response = yield* Effect.promise(() =>
			server.post({
				...(name === "missing content type" ? {} : { "content-type": "application/ndjson" }),
				host: server.host,
				origin: `http://${server.host}`,
				...headers,
			}),
		);
		expect(response.status).toBe(403);
		expect(server.calls()).toBe(0);
	});

	effectApp("rejects an Origin with a path even when its host matches", function* () {
		const response = yield* Effect.promise(() =>
			server.post({ "content-type": "application/ndjson", host: server.host, origin: `http://${server.host}/path` }),
		);
		expect(response.status).toBe(403);
		expect(server.calls()).toBe(0);
	});
});

it.live("uses the provided serialization's content type rather than a fixed NDJSON type", function* () {
	const jsonServer = yield* localRpcServer(RpcSerialization.layerJson);
	try {
		expect((yield* Effect.promise(() => jsonServer.post({ "content-type": "application/ndjson", host: jsonServer.host }))).status).toBe(403);
		expect(jsonServer.calls()).toBe(0);
		const response = yield* Effect.promise(() => jsonServer.post({ "content-type": "application/json", host: jsonServer.host }, true));
		expect(response.status).toBe(200);
		expect(response.body).toContain("pong");
		expect(jsonServer.calls()).toBe(1);
	} finally {
		yield* jsonServer.close();
	}
});
