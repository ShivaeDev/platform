import { ConfigProvider, Context, Effect, Layer, ManagedRuntime, Option } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { SqlClient } from "effect/sql";
import { expect, it } from "vitest";
import { AppChanges, appHost } from "#appHost.ts";
import { InternalServerError } from "#errors/taxonomy.ts";
import { post, sessions } from "#test/app-host/fixture.ts";
import { Ping, ping, pingHandlers } from "#test/app-host/ping.ts";

const common = { config: { port: 0 }, group: Ping, handlers: pingHandlers, services: Layer.empty };
const options = { ...common, sessions: sessions([]) };
const noEnvironment = ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }));

it("omitting migrations serves RPC without database configuration or SQL services", async () => {
	const lifecycle: string[] = [];
	const services = Layer.effectDiscard(
		Effect.acquireRelease(
			Effect.sync(() => lifecycle.push("started")),
			() => Effect.sync(() => lifecycle.push("closed")),
		),
	);
	const runtime = ManagedRuntime.make(appHost({ ...options, services }).pipe(Layer.provide(noEnvironment)));
	let url = "";
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		url = HttpServer.formatAddress(server.address);
		expect(await ping(`${url}/rpc`)).toBe("pong");
		const context = await runtime.runPromise(Effect.context());
		expect(Option.isNone(Context.getOption(context, SqlClient.SqlClient))).toBe(true);
		expect(Option.isNone(Context.getOption(context, AppChanges))).toBe(true);
		expect(lifecycle).toEqual(["started"]);
	} finally {
		await runtime.dispose();
	}
	expect(lifecycle).toEqual(["started", "closed"]);
	await expect(fetch(url)).rejects.toThrow();
});

it("rpcPath serves the native client at the chosen route instead of /rpc", async () => {
	const runtime = ManagedRuntime.make(appHost({ ...options, rpcPath: "/custom/rpc" }).pipe(Layer.provide(noEnvironment)));
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		const url = HttpServer.formatAddress(server.address);
		expect(await ping(`${url}/custom/rpc`)).toBe("pong");
		expect(await post(url, {})).toBe(404);
	} finally {
		await runtime.dispose();
	}
});

it("loopback policy serves without sessions and refuses origin, Host, content type and proxy forwarding", async () => {
	const runtime = ManagedRuntime.make(
		appHost({
			...common,
			config: { port: 0, trustedProxy: "127.0.0.1" },
			policy: "loopback",
		}).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "TRUSTED_PROXY": "127.0.0.1" } })))),
	);
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		const url = HttpServer.formatAddress(server.address);
		expect(await ping(`${url}/rpc`)).toBe("pong");
		for (const headers of [
			{ origin: "https://elsewhere.test" },
			{ host: "elsewhere.test" },
			{ "content-type": "application/json" },
			{ host: "elsewhere.test", origin: "https://elsewhere.test", "x-forwarded-host": "elsewhere.test", "x-forwarded-proto": "https" },
		]) {
			expect(await post(url, headers)).toBe(403);
		}
	} finally {
		await runtime.dispose();
	}
});

it("application routes retain native typed failures at the HTTP boundary", async () => {
	const routes = HttpRouter.add("GET", "/failed", Effect.fail(new InternalServerError({ message: "Route failed" })));
	const runtime = ManagedRuntime.make(appHost({ ...common, policy: "loopback", routes }).pipe(Layer.provide(noEnvironment)));
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		const url = HttpServer.formatAddress(server.address);
		expect((await fetch(`${url}/failed`)).status).toBe(500);
		expect(await ping(`${url}/rpc`)).toBe("pong");
	} finally {
		await runtime.dispose();
	}
});
