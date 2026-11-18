import { Context, Deferred, Effect, Layer, Queue } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { ReflectedSwitch } from "#test/reflected-switch/ReflectedSwitch.ts";

interface Stored {
	enabled: boolean;
	keepsOff: boolean;
	update: Deferred.Deferred<void> | undefined;
}

export const openHost = Effect.gen(function* () {
	const stored: Stored = { enabled: false, keepsOff: false, update: undefined };
	const updating = yield* Queue.unbounded<void>();
	const reactivity = yield* Reactivity.make;
	const live = yield* Layer.build(liveServerLayer).pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: ReflectedSwitch,
			handlers: ReflectedSwitch.application.toLayer({
				"switch.get": () =>
					Effect.gen(function* () {
						const enabled = stored.enabled;
						if (stored.update !== undefined) {
							yield* Queue.offer(updating, undefined);
							yield* Deferred.await(stored.update);
						}
						return enabled;
					}),
				"switch.set": ({ enabled }) =>
					Effect.sync(() => {
						stored.enabled = stored.keepsOff ? false : enabled;
					}),
			}),
			policy: "loopback",
			services: Layer.merge(Layer.succeedContext(live), Layer.succeed(Reactivity.Reactivity, reactivity)),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	return { stored, updating, url: `http://127.0.0.1:${server.address.port}/rpc` };
});
