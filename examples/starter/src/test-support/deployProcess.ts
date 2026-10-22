import process from "node:process";
import { NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Logger } from "effect";
import { HttpServer } from "effect/http";

const ready = Effect.gen(function* () {
	if (process.argv[2] === "worker") {
		const { noteWorker } = yield* Effect.promise(() => import("#server/noteWorker.ts"));
		yield* Layer.build(noteWorker());
		return "worker";
	}
	const { notesHost } = yield* Effect.promise(() => import("#server/notesHost.ts"));
	const context = yield* Layer.build(notesHost());
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
