import { createServer } from "node:http";
import { Effect } from "effect";
import { makeForwardingProxy } from "#adapters/makeForwardingProxy.ts";
import { loopbackServer } from "#internal/loopback.ts";

export interface ForwardingProxyOptions {
	readonly forwardedHops?: readonly string[];
	readonly headers?: Readonly<Record<string, string>>;
	readonly localAddress?: string;
}

export const forwardingProxy = Effect.fnUntraced(function* (upstream: string, options: ForwardingProxyOptions = {}) {
	if (options.localAddress !== undefined) {
		yield* Effect.scoped(loopbackServer(createServer(), { host: options.localAddress })).pipe(
			Effect.mapError((cause) => new Error(`Cannot acquire forwarding proxy with local address ${options.localAddress}`, { cause })),
		);
	}
	const proxy = yield* Effect.sync(() => makeForwardingProxy(upstream, options));
	const url = yield* loopbackServer(proxy.server);
	yield* Effect.addFinalizer(() => Effect.sync(proxy.close));
	return { disconnect: proxy.disconnect, hold: proxy.hold, online: proxy.online, url };
});
