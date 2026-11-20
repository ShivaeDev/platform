import type { Layer } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { servedHandlers } from "#adapters/servedHandlers.ts";
import type { Declared } from "#contract.ts";
import type { ModuleServices } from "#moduleProof.ts";
import type { CommandShape, QueryShape, StreamShape } from "#operation.ts";

export interface AnyModule {
	readonly "~requires": ModuleServices;
	readonly application: { readonly requests: ReadonlyMap<string, Rpc.Any> };
	readonly declaration: Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[], "session" | undefined>;
}

export type ModuleHandlers<TModule extends AnyModule> = Layer.Layer<
	Rpc.ToHandler<RpcGroup.Rpcs<TModule["application"]>>,
	never,
	TModule["~requires"][keyof TModule["~requires"]]
>;

export function moduleHandlers<TModule extends AnyModule>(module: TModule): ModuleHandlers<TModule>;
export function moduleHandlers(module: AnyModule): Layer.Layer<Rpc.Handler<string>, never, unknown> {
	return servedHandlers(module.application, module.declaration);
}
