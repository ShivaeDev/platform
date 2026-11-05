import { Context, Effect, Layer, Option, Ref } from "effect";
import { type Rpc, type RpcGroup, RpcMiddleware } from "effect/rpc";
import { invalidationKeys, type Key } from "@shivaedev/changes/keys.ts";
import { CommandResultKeys } from "#internal/CommandResultKeys.ts";
import { prependMiddleware } from "#internal/prependMiddleware.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { CommandInvalidation } from "#serverMetadata.ts";

export type CommandBoundary = <A, E, R>(effect: Effect.Effect<A, E, R>, keys: (result: A) => readonly unknown[]) => Effect.Effect<A, E, R>;

export class CommandGuard extends RpcMiddleware.Service<CommandGuard>()("@shivaedev/contract/CommandGuard") {}

export function commandGuardLayer(boundary: CommandBoundary): Layer.Layer<CommandGuard> {
	return Layer.succeed(CommandGuard, (effect, { rpc, payload }) => {
		const declaration = Context.getOption(rpc.annotations, CommandInvalidation);
		return Option.isNone(declaration)
			? effect
			: Effect.gen(function* () {
					const viewer = yield* CurrentViewer;
					const keys = yield* Ref.make<readonly Key[]>([]);
					const completed = effect.pipe(
						Effect.provideService(CommandResultKeys, keys),
						Effect.flatMap((result) => Effect.map(Ref.get(keys), (extra) => ({ extra, result }))),
					);
					const published = yield* boundary(completed, ({ extra, result }) =>
						invalidationKeys([...declaration.value.invalidates(payload, result, viewer), ...extra]),
					);
					return published.result;
				});
	});
}

export function guardCommands<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>) {
	return prependMiddleware(group.middleware(CommandGuard), CommandGuard.key);
}
