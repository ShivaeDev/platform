import { ConfigProvider, Context, Effect, Exit, Layer, Logger, References } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { forwardingProxy } from "@shivaedev/test-story/server/forwardingProxy.ts";
import { makePlatformRuntime } from "#server/runtime/makePlatform.ts";
import { runtimeLayer } from "./runtimeLayer.ts";
import { type HostState, io, runtimeOf } from "./state.ts";

export function start(state: HostState) {
	return io(async () => {
		const logger = Logger.make((options) =>
			state.logs.push({
				annotations: options.fiber.getRef(References.CurrentLogAnnotations),
				attempt: state.receiver?.requests.length ?? 0,
				level: options.logLevel,
				message: options.message,
				spans: Object.fromEntries(options.fiber.getRef(References.CurrentLogSpans)),
			}),
		);
		const layer = state
			.build(state)
			.pipe(
				Layer.provideMerge(runtimeLayer(state.runtimeLifecycle)),
				Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: state.env, preserveEmptyStrings: true }))),
				Layer.provideMerge(Layer.merge(Logger.layer([logger]), Layer.succeed(References.MinimumLogLevel, state.minimumLogLevel))),
			);
		state.runtime = makePlatformRuntime(layer);
		const exit = await state.runtime.runPromiseExit(HttpServer.HttpServer);
		if (Exit.isFailure(exit)) {
			state.bootFailure = exit.cause;
			if (!state.expectBootFailure) {
				throw new Error("App host startup failed", { cause: exit.cause });
			}
			return;
		}
		if (state.expectBootFailure) {
			throw new Error("The app host unexpectedly started");
		}
		const server = exit.value;
		state.address = server.address;
		if (!NetAddress.isInetAddress(server.address)) {
			throw new Error("Expected TCP address");
		}
		state.bindAddress = NetAddress.formatIp(server.address.address);
		state.url = `http://127.0.0.1:${server.address.port}`;
	});
}
export function close(state: HostState) {
	return io(async () => {
		state.clientAbort?.controller.abort();
		state.proxy?.setResponsive(true);
		state.subscription?.outgoing?.destroy();
		state.agent?.destroy();
		await state.runtime?.dispose();
	});
}
export const useForwardingProxy = Effect.fnUntraced(function* (state: HostState) {
	const proxy = yield* forwardingProxy(state.url, {
		headers: { host: "internal.test", "x-forwarded-host": "app.example", "x-forwarded-proto": "https" },
	});
	state.url = proxy.url;
});
export function context(state: HostState) {
	return io(() => runtimeOf(state).runPromise(Effect.context()));
}
export function hasService<TIdentifier, TService>(state: HostState, service: Context.Key<TIdentifier, TService>) {
	return context(state).pipe(Effect.map((services) => Context.getOption(services, service)._tag === "Some"));
}
