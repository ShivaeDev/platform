import { Layer } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { type AdminRegistry, type AnyAdminRegistry, mergeAdminRegistries, type RegistryPages, type UniquePageIds } from "#registry.ts";

type Registration = AnyAdminRegistry & { readonly handlers: Layer.Layer<never, unknown, unknown> };

type ModuleHandlers<TModules extends readonly Registration[]> = {
	readonly [TIndex in keyof TModules]: {
		readonly handlers: Layer.Layer<Rpc.ToHandler<RpcGroup.Rpcs<TModules[TIndex]["pages"][number]["contract"]["application"]>>, unknown, unknown>;
	};
};

export function mergeAdminRegistrations<const TModules extends readonly Registration[]>(
	...modules: TModules & NoInfer<ModuleHandlers<TModules>> & UniquePageIds<RegistryPages<TModules>>
): AdminRegistry<RegistryPages<TModules>> & {
	readonly handlers: Layer.Layer<
		Layer.Success<TModules[number]["handlers"]>,
		Layer.Error<TModules[number]["handlers"]>,
		Layer.Services<TModules[number]["handlers"]>
	>;
};
export function mergeAdminRegistrations(...modules: readonly Registration[]) {
	return {
		...mergeAdminRegistries(...modules),
		handlers: Layer.mergeAll(Layer.empty, ...modules.map((module) => module.handlers)),
	};
}
