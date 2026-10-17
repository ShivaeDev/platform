import { NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { starterHost } from "#server/starterHost.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		const context = yield* Layer.build(starterHost({ port: 0 }));
		const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
		if (!NetAddress.isInetAddress(server.address)) {
			return yield* Effect.die("Expected a TCP server");
		}
		process.stdout.write(`AUTH_URL=http://127.0.0.1:${server.address.port}\n`);
		yield* Effect.never;
	}).pipe(Effect.scoped),
);

import process from "node:process";
