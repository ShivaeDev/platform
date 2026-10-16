import process from "node:process";
import { NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Logger } from "effect";
import { HttpServer } from "effect/http";
import { noteWorker } from "#server/noteWorker.ts";
import { starterHost } from "#server/starterHost.ts";

const ready =
	process.argv[2] === "worker"
		? Layer.build(noteWorker()).pipe(Effect.as("worker"))
		: Effect.gen(function* () {
				const context = yield* Layer.build(starterHost());
				const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
				return HttpServer.formatAddress(server.address);
			});

const logger = Logger.make(({ message }) => {
	process.stdout.write(`EFFECT_LOG ${String(message)}\n`);
});

NodeRuntime.runMain(
	Effect.scoped(
		Effect.gen(function* () {
			const address = yield* ready;
			yield* Effect.sync(() => process.stdout.write(`DEPLOY_READY ${address}\n`));
			yield* Effect.never;
		}),
	).pipe(Effect.provide(Logger.layer([logger]))),
);
