import { Layer } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import type { AnyModule } from "@shivaedev/contract/moduleHandlers.ts";
import { ReplacedModuleHandlers } from "#servedModules.ts";

// A fake serves the module's queries itself, so their read policies run only through the host's guard, in the fake's context.
export function replacedModuleHandlers<TRpcs extends Rpc.Any, A, E, R>(module: RpcGroup.RpcGroup<TRpcs> & AnyModule, handlers: Layer.Layer<A, E, R>) {
	const group: RpcGroup.RpcGroup<TRpcs> = module;
	return { group, handlers: handlers.pipe(Layer.provide(Layer.succeed(ReplacedModuleHandlers, module.declaration.name))) };
}
