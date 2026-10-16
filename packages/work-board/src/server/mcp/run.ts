import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer, Logger, Path } from "effect";
import { McpProtocol, McpServer } from "effect/ai";
import { Argument, Command } from "effect/cli";
import { mcpTools } from "./tools.ts";

const command = Command.make(
	"mcp",
	{
		dir: Argument.String("dir").pipe(Argument.withDescription("The directory of the running board")),
	},
	({ dir }) =>
		Effect.gen(function* () {
			const path = yield* Path.Path;
			return yield* Layer.launch(
				mcpTools(path.resolve(dir)).pipe(
					Layer.provide(
						McpServer.layerStdio({
							name: "work-board",
							protocols: [McpProtocol.v2025_11_25, McpProtocol.v2025_06_18, McpProtocol.v2025_03_26, McpProtocol.v2024_11_05],
							version: "0.13.0",
						}),
					),
				),
			);
		}),
);

export function runMcp() {
	Command.runWith(command, { version: "0.13.0" })(process.argv.slice(3)).pipe(
		Effect.provideService(Logger.LogToStderr, true),
		Effect.provide(NodeServices.layer),
		NodeRuntime.runMain,
	);
}
