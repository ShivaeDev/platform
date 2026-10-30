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

type Held = "services" | "handlers" | "routes";

interface State {
	readonly held: Deferred.Deferred<void>;
	readonly port: number;
	readonly release: Deferred.Deferred<void>;
	startup?: Fiber.Fiber<unknown, unknown>;
}

export const readiness = storyKit({
	clock: "live",
	*create(): Effect.fn.Return<State> {
		return {
			held: yield* Deferred.make<void>(),
			port: yield* Effect.promise(availablePort),
			release: yield* Deferred.make<void>(),
		};
	},
	name: "host readiness",
	stages: ["starting"],
	verbs: (state, story) => ({
		connectionAttempt: () =>
			Effect.promise(
				() =>
					new Promise<string>((resolve) => {
						const socket = createConnection({ host: "127.0.0.1", port: state.port });
						socket.once("connect", () => {
							socket.destroy();
							resolve("connected");
						});
						socket.once("error", (error) => resolve("code" in error && error.code === "ECONNREFUSED" ? "refused" : error.message));
					}),
			),
		constructionFinishes: () =>
			Effect.gen(function* () {
				story.tell("the held construction finishes and the host starts listening");
				yield* Deferred.succeed(state.release, undefined);
				if (state.startup !== undefined) {
					yield* Fiber.join(state.startup);
				}
			}),
		firstResponse: () =>
			Effect.promise(async () => {
				const response = await fetch(`http://127.0.0.1:${state.port}/ready`);
				return { body: await response.text(), status: response.status };
			}),
	}),
});

export function constructionHeldIn(held: Held) {
	return readiness.trait("starting", `the host starts while its ${held} are still being constructed`, function* (state) {
		const hold = Deferred.succeed(state.held, undefined).pipe(Effect.andThen(Deferred.await(state.release)));
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
		state.startup = yield* Layer.build(
			appHost({ config: { host: "127.0.0.1", port: state.port }, group: Ping, handlers, policy: "loopback", routes, services }),
		).pipe(Effect.forkScoped);
		yield* Deferred.await(state.held);
	});
}
