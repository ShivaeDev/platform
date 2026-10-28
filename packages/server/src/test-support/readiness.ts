import { createConnection, createServer } from "node:net";
import { Context, Deferred, Effect, Fiber, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appHost.ts";
import { Ping } from "#test/app-host/ping.ts";

class Greeting extends Context.Service<Greeting, string>()("readiness/Greeting") {}

async function availablePort() {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a TCP address");
	}
	await new Promise<void>((resolve) => server.close(() => resolve()));
	return address.port;
}

export const readiness = storyKit({
	clock: "live",
	*create() {
		return {
			held: yield* Deferred.make<void>(),
			port: yield* Effect.promise(availablePort),
			release: yield* Deferred.make<void>(),
		};
	},
	name: "host readiness",
	stages: [],
	verbs: (state) => {
		const hold = Deferred.succeed(state.held, undefined).pipe(Effect.andThen(Deferred.await(state.release)));
		return {
			connection: Effect.promise(
				() =>
					new Promise<string>((resolve) => {
						const socket = createConnection({ host: "127.0.0.1", port: state.port });
						socket.once("connect", () => {
							socket.destroy();
							resolve("connected");
						});
						socket.once("error", (error) => resolve("code" in error ? String(error.code) : error.message));
					}),
			),
			constructionHeld: Deferred.await(state.held),
			firstResponse: Effect.promise(async () => {
				const response = await fetch(`http://127.0.0.1:${state.port}/ready`);
				return { body: await response.text(), status: response.status };
			}),
			releaseConstruction: Deferred.succeed(state.release, undefined),
			start: (held: "services" | "handlers" | "routes") => {
				const services = Layer.effect(Greeting, Effect.as(held === "services" ? hold : Effect.void, "Ready"));
				const handlers = Ping.toLayer(
					Effect.gen(function* () {
						if (held === "handlers") {
							yield* hold;
						}
						const greeting = yield* Greeting;
						return { ping: () => Effect.succeed(greeting) };
					}),
				);
				const routes = HttpRouter.use((router) =>
					Effect.gen(function* () {
						if (held === "routes") {
							yield* hold;
						}
						const greeting = yield* Greeting;
						yield* router.add("GET", "/ready", HttpServerResponse.text(greeting));
					}),
				);
				return Layer.build(
					appHost({ config: { host: "127.0.0.1", port: state.port }, group: Ping, handlers, policy: "loopback", routes, services }),
				).pipe(Effect.forkScoped);
			},
			waitForListening: <A, E>(startup: Fiber.Fiber<A, E>) => Fiber.join(startup),
		};
	},
});
