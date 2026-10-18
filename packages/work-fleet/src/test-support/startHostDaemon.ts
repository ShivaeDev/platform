import { Context, Effect, Exit, Layer, Scope } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { daemonClient } from "#host/daemonClient.ts";
import type { readDaemonLayer } from "#test/readDaemon.ts";

export const startHostDaemon = Effect.fn("HostStory.startHostDaemon")(function* (layer: ReturnType<typeof readDaemonLayer>) {
	const scope = yield* Scope.make();
	const stop = Scope.close(scope, Exit.void);
	yield* Effect.addFinalizer(() => stop);
	const context = yield* Layer.buildWithScope(Layer.fresh(layer), scope);
	const address = Context.get(context, HttpServer.HttpServer).address;
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Expected a TCP Fleet daemon");
	}
	return { client: yield* daemonClient(address.port), context, port: address.port, stop };
});

export type HostDaemon = Effect.Success<ReturnType<typeof startHostDaemon>>;
