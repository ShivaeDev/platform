import { NodeFileSystem } from "@effect/platform-node";
import { ConfigProvider, Context, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { Watcher } from "#Watcher.ts";
import { makeIo } from "./io.ts";
import { startServer } from "./server.ts";
import { services } from "./services.ts";

export const nativeIo = Layer.mergeAll(
	NodeFileSystem.layer,
	FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ redirect: "error" }))),
);
export const makeEngine = Effect.gen(function* () {
	const server = yield* Effect.acquireRelease(Effect.promise(startServer), (acquired) => Effect.promise(acquired.close));
	const io = yield* makeIo;
	const layer = services.pipe(
		Layer.provide(io.layer),
		Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ "GH_TOKEN": "test-token" }))),
	);
	const context = yield* Layer.build(Layer.fresh(layer));
	const lines: string[] = [];
	const diagnostics: string[] = [];
	return {
		...server,
		context,
		diagnostic: (line: string) =>
			Effect.sync(() => {
				diagnostics.push(line);
			}),
		diagnostics,
		emit: (line: string) =>
			Effect.sync(() => {
				lines.push(line);
			}),
		io,
		layer,
		lines,
		watcher: Context.get(context, Watcher),
	};
});
export type Engine = Effect.Success<typeof makeEngine>;
