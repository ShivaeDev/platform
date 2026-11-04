import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, type Scope } from "effect";
import { CliConfig, Command, GlobalFlag } from "effect/cli";

export interface ScriptOptions<TArgs extends Command.Command.Config, E> {
	readonly args: TArgs;
	readonly run: (args: Command.Command.Config.Infer<TArgs>) => Effect.Effect<unknown, E, NodeServices.NodeServices | Scope.Scope>;
}

export function defineScript<const TArgs extends Command.Command.Config, E>(options: ScriptOptions<TArgs, E>): void {
	const command = Command.make("script", options.args, options.run);
	NodeRuntime.runMain(
		Command.run(command, { version: "" }).pipe(
			Effect.provideService(CliConfig.CliConfig, { builtIns: [GlobalFlag.Help, GlobalFlag.LogLevel] }),
			Effect.scoped,
			Effect.provide(NodeServices.layer),
		),
	);
}
