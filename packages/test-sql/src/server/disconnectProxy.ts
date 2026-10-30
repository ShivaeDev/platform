import { Effect } from "effect";
import { openDisconnectProxy } from "#adapters/openDisconnectProxy.ts";

export interface DisconnectProxyOptions {
	readonly dropNotifications?: boolean;
	readonly holdDisconnects?: boolean;
}

export const disconnectProxy = Effect.fnUntraced(function* (destination: string, options: DisconnectProxyOptions = {}) {
	return yield* Effect.acquireRelease(
		Effect.promise(() => openDisconnectProxy(destination, options)),
		(proxy) => Effect.promise(proxy.close),
	);
});
