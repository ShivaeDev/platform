import { Effect, Layer, Option } from "effect";
import { type Rpc, RpcGroup, type RpcMiddleware } from "effect/rpc";
import { type AnyModule, type ModuleHandlers, moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import type { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import type { AdminPage } from "#page.ts";
import { type AdminRegistry, validateAdminRegistry } from "#registry.ts";
import { pagePermissions } from "#server/pagePermissions.ts";

export type ServedModule = AnyModule &
	RpcGroup.Any & {
		readonly requests: ReadonlyMap<string, Rpc.AnyWithProps>;
		middleware: (middleware: RpcMiddleware.AnyService) => RpcGroup.Any;
	};

type Same<TLeft, TRight> = [TLeft] extends [TRight] ? ([TRight] extends [TLeft] ? true : false) : false;
type Tags<TGroup> = TGroup extends RpcGroup.RpcGroup<infer TRpcs> ? TRpcs["_tag"] : never;
type PageOf<TPages extends readonly AdminPage[], TId> = Extract<TPages[number], { readonly id: TId }>;

// The host serves exactly the module's operations under the page's permission, so a module with more would widen the page.
type ServesThePage<TPages extends readonly AdminPage[], TModules> = {
	readonly [TId in keyof TModules]: TModules[TId] extends ServedModule
		? Same<Tags<TModules[TId]["application"]>, Tags<PageOf<TPages, TId>["contract"]["application"]>> extends true
			? unknown
			: { readonly "The module must serve exactly the page's operations": TId }
		: never;
};

type PageModules<TPages extends readonly AdminPage[]> = { readonly [TPage in TPages[number] as TPage["id"]]: ServedModule };

type Handlers<TModules> = TModules[keyof TModules] extends infer TModule ? (TModule extends ServedModule ? ModuleHandlers<TModule> : never) : never;

export function registerAdmin<const TPages extends readonly AdminPage[], const TModules extends PageModules<TPages>>(
	registry: AdminRegistry<TPages>,
	modules: TModules & ServesThePage<TPages, TModules> & Record<Exclude<keyof TModules, TPages[number]["id"]>, never>,
): {
	readonly group: RpcGroup.RpcGroup<RpcGroup.Rpcs<TPages[number]["contract"]>>;
	readonly pages: TPages;
	readonly handlers: Layer.Layer<
		| Layer.Success<Handlers<TModules>>
		| Extract<Rpc.Middleware<RpcGroup.Rpcs<TPages[number]["contract"]>>, { readonly key: TPages[number]["permissionKey"] }>,
		never,
		Layer.Services<Handlers<TModules>> | SessionPolicy
	>;
};
export function registerAdmin(
	registry: AdminRegistry<readonly AdminPage[]>,
	modules: Readonly<Record<string, ServedModule>>,
): { readonly group: RpcGroup.Any; readonly handlers: Layer.Layer<never, unknown, unknown>; readonly pages: readonly AdminPage[] } {
	const served = registry.pages.flatMap((page) => {
		const module = Object.hasOwn(modules, page.id) ? modules[page.id] : undefined;
		return module === undefined ? [] : [{ module, page }];
	});
	const registered = Layer.unwrap(
		validateAdminRegistry(registry.pages).pipe(
			Effect.andThen(validateModules(registry.pages, modules)),
			Effect.as(
				Layer.mergeAll(Layer.empty, ...served.map(({ module }) => moduleHandlers(module))).pipe(Layer.provideMerge(pagePermissions(registry))),
			),
		),
	);
	return {
		group: RpcGroup.make().merge(...served.map(({ module, page }) => withPermission(module, page))),
		handlers: registered,
		pages: registry.pages,
	};
}

function tagsOf(group: { readonly requests: ReadonlyMap<string, Rpc.Any> }) {
	return new Set(group.requests.keys());
}

const validateModules = Effect.fnUntraced(function* (pages: readonly AdminPage[], modules: Readonly<Record<string, ServedModule>>) {
	const ids = new Set(pages.map((page) => page.id));
	for (const page of pages) {
		const module = Object.hasOwn(modules, page.id) ? modules[page.id] : undefined;
		if (module === undefined) {
			return yield* Effect.die(new Error(`Missing admin module: ${page.id}`));
		}
		const pageTags = tagsOf(page.contract);
		const moduleTags = tagsOf(module);
		if (pageTags.size !== moduleTags.size || [...pageTags].some((tag) => !moduleTags.has(tag))) {
			return yield* Effect.die(new Error(`Admin page ${page.id} is served by a module whose operations differ from the page's`));
		}
	}
	for (const id of Object.keys(modules)) {
		if (!ids.has(id)) {
			return yield* Effect.die(new Error(`Unregistered admin module: ${id}`));
		}
	}
});

// The page's contract carries its permission on every RPC; the module that serves it gets the same middleware unless it has it.
function withPermission(module: ServedModule, page: AdminPage): RpcGroup.Any {
	const [first] = page.contract.requests.values();
	const permission = Option.fromUndefinedOr(first?.middlewares).pipe(
		Option.flatMap((middlewares) => Option.fromUndefinedOr([...middlewares].find((middleware) => middleware.key === page.permissionKey))),
	);
	const guarded = [...module.requests.values()].every((rpc) => [...rpc.middlewares].some((middleware) => middleware.key === page.permissionKey));
	return Option.isNone(permission) || guarded ? module : module.middleware(permission.value);
}
