import { ConfigProvider, Layer, ManagedRuntime } from "effect";
import { type HttpRouter, HttpServer } from "effect/http";
import { appHost } from "#appHost.ts";
import { Ping, ping, pingHandlers } from "#test/app-host/ping.ts";

export function otlpConfig(env: Record<string, string>) {
	return ConfigProvider.layer(ConfigProvider.fromEnv({ env }));
}
export function otlpHost(env: Record<string, string>, routes: Layer.Layer<never, never, HttpRouter.HttpRouter> = Layer.empty) {
	return ManagedRuntime.make(
		appHost({ config: { port: 0 }, group: Ping, handlers: pingHandlers, policy: "loopback", routes }).pipe(Layer.provide(otlpConfig(env))),
	);
}
export async function pingHost(runtime: ReturnType<typeof otlpHost>) {
	const server = await runtime.runPromise(HttpServer.HttpServer);
	return ping(`${HttpServer.formatAddress(server.address)}/rpc`);
}
