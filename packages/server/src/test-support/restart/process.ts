import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Clock, Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { appHost } from "#appHost.ts";
import { reportHostReady } from "#testing/hostProcessChild.ts";
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
				services: LiveServer.layer.pipe(Layer.provideMerge(Reactivity.layer)),
			}),
		);
		yield* reportHostReady.pipe(Effect.provideContext(context));
		yield* Effect.never;
	}).pipe(Effect.scoped),
);
