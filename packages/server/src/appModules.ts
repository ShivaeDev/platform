import { Effect, Layer } from "effect";
import { RpcGroup } from "effect/rpc";
import type { Migrator } from "effect/sql";
import type { AdminPage } from "@shivaedev/admin/page.ts";
import type { AdminRegistry, AnyAdminRegistry } from "@shivaedev/admin/registry.ts";
import { mergeAdminRegistrations } from "@shivaedev/admin/server/mergeAdminRegistrations.ts";
import { type AnyModule, type ModuleHandlers, moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";
import type { AppModule, ModuleAdmin, ModuleLayer } from "#AppModule.ts";
import type { DuplicateModuleQueue } from "#DuplicateModuleQueue.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";
import { moduleQueues } from "#moduleQueues.ts";
import type { ProvidedModules } from "#providedModules.ts";
import type { GlobalServices } from "#requestServices.ts";

type ModuleField<TModules, TKey extends PropertyKey> = TModules extends unknown ? (TKey extends keyof TModules ? TModules[TKey] : never) : never;
type Layers<TModules extends readonly AppModule[], TKey extends "handlers" | "services" | "ports" | "workers" | "requestServices"> = Extract<
	ModuleField<TModules[number], TKey>,
	Layer.Any
>;
type ServedHandlers<TModule> = TModule extends { readonly module: infer TDefined extends AnyModule } ? ModuleHandlers<TDefined> : never;
// A registration typed as AppModule has lost its module's services, so ServedHandlers would serve it as requiring nothing.
// Only a tuple is checked: inference sees the bare constraint, and a check that refuses it breaks inference of every registration list.
type WidenedModule<TModule> = TModule extends { readonly module: infer TDefined } ? (TDefined extends AnyModule ? never : TModule) : never;
type ExactModules<TModules extends readonly AppModule[]> = number extends TModules["length"]
	? unknown
	: {
			readonly [TKey in keyof TModules]: [WidenedModule<TModules[TKey]>] extends [never]
				? unknown
				: { readonly "Declare a defined module's registration with satisfies AppModule so its type keeps the module's services": never };
		};
type Groups<TModules extends readonly AppModule[]> = Extract<
	ModuleField<TModules[number], "group"> | ModuleField<TModules[number], "module">,
	RpcGroup.Any
>;
type Admin<TModules extends readonly AppModule[]> = Extract<ModuleField<TModules[number], "admin">, ModuleAdmin>;
type Handlers<TModules extends readonly AppModule[]> =
	| Layers<TModules, "handlers">
	| ServedHandlers<TModules[number]>
	| Extract<ModuleField<Admin<TModules>, "handlers">, Layer.Any>;
type Pages<TModules extends readonly AppModule[]> = Extract<ModuleField<Admin<TModules>, "pages">, readonly AdminPage[]>;
type Queues<TModules extends readonly AppModule[]> = Extract<ModuleField<TModules[number], "queues">, readonly { readonly name: string }[]>[number];
type Ports<TModules extends readonly AppModule[]> = Layers<TModules, "ports">;
type RequestLayer<TModule> = TModule extends { readonly requestServices: infer TLayer extends Layer.Any } ? TLayer : never;
type RequestServices<TModules extends readonly AppModule[]> = RequestLayer<TModules[number]>;
type Services<TModules extends readonly AppModule[]> = Layers<TModules, "services">;
type Migrations<TModules extends readonly AppModule[]> = ModuleField<TModules[number], "migrations">;
type MigrationRequirements<TModules extends readonly AppModule[]> = Effect.Services<ModuleField<Migrations<TModules>, "loader">>;
type Components<T> = T extends readonly (infer TComponent extends SchemaComponent<unknown, unknown>)[] ? TComponent : never;
type ModuleComponents<TModules extends readonly AppModule[]> = Components<ModuleField<Migrations<TModules>, "components">>;

export function appModules<const TModules extends readonly AppModule[], R = never, E = never, TRequirements = never>(
	modules: TModules &
		GlobalServices<Layer.Services<Services<NoInfer<TModules>>>, Layer.Success<RequestServices<NoInfer<TModules>>>> &
		ExactModules<NoInfer<TModules>> &
		ProvidedModules<NoInfer<TModules>>,
	options?: { readonly replacements?: Layer.Layer<R, E, TRequirements> },
): Effect.Effect<
	{
		readonly workers: Layer.Layer<
			Layer.Success<Layers<TModules, "workers">>,
			Layer.Error<Layers<TModules, "workers">>,
			Layer.Services<Layers<TModules, "workers">>
		>;
		readonly queues: readonly Queues<TModules>[];
		readonly admin: AdminRegistry<readonly Pages<TModules>[number][]>;
		readonly group: RpcGroup.RpcGroup<RpcGroup.Rpcs<Groups<TModules> | ModuleField<Admin<TModules>, "group">>>;
		readonly handlers: Layer.Layer<Layer.Success<Handlers<TModules>>, Layer.Error<Handlers<TModules>>, Layer.Services<Handlers<TModules>>>;
		readonly requestServices: Layer.Layer<
			Layer.Success<Layers<TModules, "requestServices">>,
			never,
			Layer.Services<Layers<TModules, "requestServices">>
		>;
		readonly services: Layer.Layer<
			Layer.Success<Services<TModules> | Ports<TModules>> | R,
			Layer.Error<Services<TModules> | Ports<TModules>> | E,
			Exclude<Layer.Services<Services<TModules>>, Layer.Success<Ports<TModules>> | R> | Layer.Services<Ports<TModules>> | TRequirements
		>;
		readonly migrations: {
			readonly loader: Migrator.Loader<MigrationRequirements<TModules>>;
			readonly components: readonly ModuleComponents<TModules>[];
		};
	},
	DuplicateModuleQueue
>;
export function appModules(
	modules: readonly AppModule[],
	options?: { readonly replacements?: ModuleLayer },
): Effect.Effect<
	{
		readonly workers: ModuleLayer;
		readonly queues: readonly { readonly name: string }[];
		readonly admin: AnyAdminRegistry;
		readonly group: RpcGroup.Any;
		readonly handlers: ModuleLayer;
		readonly migrations: MigrationOptions<unknown, unknown>;
		readonly requestServices: Layer.Layer<never, never, unknown>;
		readonly services: ModuleLayer;
	},
	DuplicateModuleQueue
> {
	return composeModules(modules, options);
}

const composeModules = Effect.fnUntraced(function* (modules: readonly AppModule[], options?: { readonly replacements?: ModuleLayer }) {
	const queues = yield* moduleQueues(modules);
	const registrations = modules.flatMap((module) => (module.admin === undefined ? [] : [module.admin]));
	const admin = mergeAdminRegistrations(...registrations);
	const defaults = Layer.mergeAll(Layer.empty, ...modules.map((module) => module.ports ?? Layer.empty));
	const ports = Layer.merge(defaults, options?.replacements ?? Layer.empty);
	return {
		admin,
		group: RpcGroup.make().merge(...modules.flatMap(servedGroup), admin.group),
		handlers: Layer.mergeAll(admin.handlers, ...modules.flatMap(servedHandlers)),
		migrations: {
			components: modules.flatMap((module) => module.migrations?.components ?? []),
			loader: Effect.all(modules.flatMap((module) => (module.migrations === undefined ? [] : [module.migrations.loader]))).pipe(
				Effect.map((entries) => entries.flat()),
			),
		},
		queues,
		requestServices: Layer.mergeAll(Layer.empty, ...modules.map((module) => module.requestServices ?? Layer.empty)),
		services: Layer.mergeAll(Layer.empty, ...modules.map((module) => module.services ?? Layer.empty)).pipe(Layer.provideMerge(ports)),
		workers: Layer.mergeAll(Layer.empty, ...modules.map((module) => module.workers ?? Layer.empty)),
	};
});

function servedGroup(module: AppModule): readonly RpcGroup.Any[] {
	if (module.module !== undefined) {
		return [module.module];
	}
	return module.group === undefined ? [] : [module.group];
}

// The overload types each module's handlers from its operations' services; at run time moduleHandlers reads only its operations.
function servedHandlers(module: AppModule): readonly ModuleLayer[] {
	if (module.module !== undefined) {
		return [moduleHandlers({ "~requires": {}, application: module.module.application, declaration: module.module.declaration })];
	}
	return module.handlers === undefined ? [] : [module.handlers];
}
