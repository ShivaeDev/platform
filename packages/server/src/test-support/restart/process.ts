import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Clock, Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { AppChanges, appHost } from "#appHost.ts";
import { RestartNotes } from "./Notes.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		const context = yield* Layer.build(
			appHost({
				config: { port: Number(process.argv[2]) },
				group: RestartNotes,
				handlers: RestartNotes.application.toLayer({
					"restartNotes.get": ({ id, tab }) => Effect.map(Clock.currentTimeMillis, (readAt) => ({ id, pid: process.pid, readAt, tab })),
				}),
				policy: "loopback",
				services: Layer.effect(AppChanges, makeLiveServer).pipe(Layer.provideMerge(Reactivity.layer)),
			}),
		);
		const { address } = Context.get(context, HttpServer.HttpServer);
		if (!NetAddress.isInetAddress(address)) {
			return yield* Effect.die("Expected a TCP host");
		}
		process.send?.({ pid: process.pid, port: address.port });
		yield* Effect.never;
	}).pipe(Effect.scoped),
);
