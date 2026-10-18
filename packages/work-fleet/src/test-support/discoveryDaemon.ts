import { Context, Effect, Exit, Layer, Scope } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import type { HostFixture } from "#test/fleetHost.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";

const { DAEMON_PORT } = diagnosticsApi;

export const discoveryDaemon = Effect.fn("DaemonStory.discoveryDaemon")(function* (fixture: HostFixture) {
	const scope = yield* Scope.make();
	const close = Scope.close(scope, Exit.void);
	yield* Effect.addFinalizer(() => close);
	const subscribed = Promise.withResolvers<void>();
	const context = yield* Layer.buildWithScope(readDaemonLayer(fixture.host, { onSnapshot: () => subscribed.resolve(), parts: fixture.parts }), scope);
	const address = Context.get(context, HttpServer.HttpServer).address;
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Expected a TCP Fleet daemon");
	}
	if (address.port === DAEMON_PORT) {
		return yield* Effect.die("Discovery stories require a non-default daemon port");
	}
	return { close, port: address.port, reactivity: Context.get(context, Reactivity.Reactivity), subscribed: subscribed.promise };
});
