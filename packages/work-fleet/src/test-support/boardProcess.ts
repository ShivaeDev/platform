import { dirname } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { serveBoard } from "@shivaedev/work-board/server/serve.ts";

const config = process.argv[2];
if (config === undefined) {
	throw new Error("A Board config path is required");
}
await Effect.runPromise(Layer.launch(serveBoard({ port: 0, responses: true, root: dirname(config) })).pipe(Effect.provide(NodeServices.layer)));
