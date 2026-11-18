import { Context, Deferred, Effect, Layer, Queue, Schema } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { contract } from "@shivaedev/contract/contract.ts";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { appHost } from "@shivaedev/server/appHost.ts";

const PAGE = { _tag: "Item", collection: "reflected-pages", id: 1 } as const;

export const ReflectedPage = contract("reflected", {
	commands: [
		command("write", { invalidates: () => [PAGE], payload: { title: Schema.String }, success: Schema.Void }),
		command("touch", { invalidates: () => [], success: Schema.Void }),
	],
	queries: [query("title", { readPolicy: () => Effect.succeed(true), reads: () => [PAGE], success: Schema.String })],
});

export const reflectedPageHost = Effect.gen(function* () {
	const page: { title: string; update: Deferred.Deferred<void> | undefined } = { title: "First page", update: undefined };
	const updating = yield* Queue.unbounded<void>();
	const reactivity = yield* Reactivity.make;
	const live = yield* Layer.build(liveServerLayer).pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: ReflectedPage,
			handlers: ReflectedPage.application.toLayer({
				"reflected.title": () =>
					Effect.gen(function* () {
						const title = page.title;
						if (page.update !== undefined) {
							yield* Queue.offer(updating, undefined);
							yield* Deferred.await(page.update);
						}
						return title;
					}),
				"reflected.touch": () => Effect.void,
				"reflected.write": ({ title }) =>
					Effect.sync(() => {
						page.title = title;
					}),
			}),
			policy: "loopback",
			services: Layer.merge(Layer.succeedContext(live), Layer.succeed(Reactivity.Reactivity, reactivity)),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP page host");
	}
	return { page, updating, url: `http://127.0.0.1:${server.address.port}/rpc` };
});
