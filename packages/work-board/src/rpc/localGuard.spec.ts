import { RpcSerialization } from "effect/unstable/rpc";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localRpcServer } from "#test/localRpcServer.ts";

describe("local RPC over real HTTP", () => {
	let server: Awaited<ReturnType<typeof localRpcServer>>;
	beforeEach(async () => {
		server = await localRpcServer();
	});
	afterEach(async () => {
		await server.close();
	});
	it("runs the handler for a loopback same-origin request without a session provider", async () => {
		const response = await server.post({ "content-type": "application/ndjson; charset=utf-8", host: server.host, origin: `http://${server.host}` });
		expect(response.status).toBe(200);
		expect(response.body).toContain("pong");
		expect(server.calls()).toBe(1);
	});
	it("allows a local client without an Origin", async () => {
		expect((await server.post({ "content-type": "application/ndjson", host: server.host })).status).toBe(200);
		expect(server.calls()).toBe(1);
	});
	it.each(["localhost", "127.0.0.2", "[::1]"])("accepts a loopback Host: %s", async (host) => {
		const response = await server.post({ "content-type": "application/ndjson", host, origin: `http://${host}` });
		expect(response.status).toBe(200);
		expect(server.calls()).toBe(1);
	});
	it.each([
		["foreign Origin", { origin: "http://foreign.example" }],
		["non-loopback Host", { host: "192.0.2.1" }],
		["DNS-rebinding Host on a loopback connection", { host: "rebound.example" }],
		["wrong content type", { "content-type": "application/json" }],
		["missing content type", {}],
		["malformed Origin", { origin: ":invalid:" }],
		["Host with user information", { host: "foreign.example@localhost" }],
		["malformed Host", { host: "[" }],
	])("rejects a %s before the RPC handler runs", async (name, headers) => {
		const response = await server.post({
			...(name === "missing content type" ? {} : { "content-type": "application/ndjson" }),
			host: server.host,
			origin: `http://${server.host}`,
			...headers,
		});
		expect(response.status).toBe(403);
		expect(server.calls()).toBe(0);
	});
	it("rejects an Origin with a path even when its host matches", async () => {
		const response = await server.post({ "content-type": "application/ndjson", host: server.host, origin: `http://${server.host}/path` });
		expect(response.status).toBe(403);
		expect(server.calls()).toBe(0);
	});
});

it("uses the provided serialization's content type rather than a fixed NDJSON type", async () => {
	const server = await localRpcServer(RpcSerialization.layerJson);
	try {
		expect((await server.post({ "content-type": "application/ndjson", host: server.host })).status).toBe(403);
		expect(server.calls()).toBe(0);
		const response = await server.post({ "content-type": "application/json", host: server.host }, true);
		expect(response.status).toBe(200);
		expect(response.body).toContain("pong");
		expect(server.calls()).toBe(1);
	} finally {
		await server.close();
	}
});
