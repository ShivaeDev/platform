import { Context, Effect, Layer, Option } from "effect";
import { type Rpc, type RpcGroup, RpcMiddleware } from "effect/rpc";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { prependMiddleware } from "#prependMiddleware.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { CommandInvalidation } from "#serverMetadata.ts";

export type CommandBoundary = <A, E, R>(effect: Effect.Effect<A, E, R>, keys: (result: A) => readonly unknown[]) => Effect.Effect<A, E, R>;

export class CommandGuard extends RpcMiddleware.Service<CommandGuard>()("@shivaedev/contract/CommandGuard") {}

export function commandGuardLayer(boundary: CommandBoundary): Layer.Layer<CommandGuard> {
	return Layer.succeed(CommandGuard, (effect, { rpc, payload }) => {
		const declaration = Context.getOption(rpc.annotations, CommandInvalidation);
		return Option.isNone(declaration)
			? effect
			: Effect.flatMap(CurrentViewer, (viewer) =>
					boundary(effect, (result) => invalidationKeys(declaration.value.invalidates(payload, result, viewer))),
				);
	});
}

export function guardCommands<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>) {
	return prependMiddleware(group.middleware(CommandGuard), CommandGuard.key);
}
