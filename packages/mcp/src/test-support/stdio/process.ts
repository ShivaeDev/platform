import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer, Logger } from "effect";
import { mcpStdio } from "#stdio.ts";
import { resourceFile, resourceTools } from "./tools.ts";

const file = process.argv[2];
if (file === undefined) {
	throw new Error("Expected a resource file");
}

mcpStdio({ name: "Resource story", tools: resourceTools.pipe(Layer.provide(resourceFile(file).layer)), version: "1" }).pipe(
	Layer.launch,
	Effect.provideService(Logger.LogToStderr, true),
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);
