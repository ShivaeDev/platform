import { Effect, Layer } from "effect";
import { RpcGroup } from "effect/rpc";
import type { Migrator } from "effect/sql";
import type { AdminPage } from "@shivaedev/admin/page.ts";
import type { AdminRegistry, AnyAdminRegistry } from "@shivaedev/admin/registry.ts";
import { mergeAdminRegistrations } from "@shivaedev/admin/server/mergeAdminRegistrations.ts";
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";
import type { AppModule, ModuleAdmin, ModuleLayer } from "#AppModule.ts";
import { DuplicateModuleQueue } from "#DuplicateModuleQueue.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";

type ModuleField<TModules, TKey extends PropertyKey> = TModules extends unknown ? (TKey extends keyof TModules ? TModules[TKey] : never) : never;
type Layers<TModules extends readonly AppModule[], TKey extends "handlers" | "services" | "ports" | "workers"> = Extract<
	ModuleField<TModules[number], TKey>,
	Layer.Any
>;
type Admin<TModules extends readonly AppModule[]> = Extract<ModuleField<TModules[number], "admin">, ModuleAdmin>;
type Handlers<TModules extends readonly AppModule[]> = Layers<TModules, "handlers"> | Extract<ModuleField<Admin<TModules>, "handlers">, Layer.Any>;
type Pages<TModules extends readonly AppModule[]> = Extract<ModuleField<Admin<TModules>, "pages">, readonly AdminPage[]>;
type Queues<TModules extends readonly AppModule[]> = Extract<ModuleField<TModules[number], "queues">, readonly { readonly name: string }[]>[number];
type Ports<TModules extends readonly AppModule[]> = Layers<TModules, "ports">;
type Services<TModules extends readonly AppModule[]> = Layers<TModules, "services">;
type MigrationRequirements<TModules extends readonly AppModule[]> = Effect.Services<TModules[number]["migrations"]["loader"]>;
type Components<T> = T extends readonly (infer TComponent extends SchemaComponent<unknown, unknown>)[] ? TComponent : never;
type ModuleComponents<TModules extends AppModule> = Components<ModuleField<TModules["migrations"], "components">>;

export function appModules<const TModules extends readonly AppModule[], R = never, E = never, TRequirements = never>(
	modules: TModules,
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
		readonly group: RpcGroup.RpcGroup<RpcGroup.Rpcs<TModules[number]["group"] | ModuleField<Admin<TModules>, "group">>>;
		readonly handlers: Layer.Layer<Layer.Success<Handlers<TModules>>, Layer.Error<Handlers<TModules>>, Layer.Services<Handlers<TModules>>>;
		readonly services: Layer.Layer<
			Layer.Success<Services<TModules> | Ports<TModules>> | R,
			Layer.Error<Services<TModules> | Ports<TModules>> | E,
			Exclude<Layer.Services<Services<TModules>>, Layer.Success<Ports<TModules>> | R> | Layer.Services<Ports<TModules>> | TRequirements
		>;
		readonly migrations: {
			readonly loader: Migrator.Loader<MigrationRequirements<TModules>>;
			readonly components: readonly ModuleComponents<TModules[number]>[];
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
		readonly services: ModuleLayer;
	},
	DuplicateModuleQueue
> {
	return composeModules(modules, options);
}

const composeModules = Effect.fnUntraced(function* (modules: readonly AppModule[], options?: { readonly replacements?: ModuleLayer }) {
	const owners = new Map<string, string>();
	for (const module of modules) {
		for (const queue of module.queues ?? []) {
			const firstModule = owners.get(queue.name);
			if (firstModule !== undefined) {
				return yield* new DuplicateModuleQueue({ firstModule, queue: queue.name, secondModule: module.name });
			}
			owners.set(queue.name, module.name);
		}
	}
	const queues = modules.flatMap((module) => module.queues ?? []);
	const registrations = modules.flatMap((module) => (module.admin === undefined ? [] : [module.admin]));
	const admin = mergeAdminRegistrations(...registrations);
	const defaults = Layer.mergeAll(Layer.empty, ...modules.map((module) => module.ports ?? Layer.empty));
	const ports = Layer.merge(defaults, options?.replacements ?? Layer.empty);
	return {
		admin,
		group: RpcGroup.make().merge(...modules.map((module) => module.group), admin.group),
		handlers: Layer.mergeAll(admin.handlers, ...modules.map((module) => module.handlers)),
		migrations: {
			components: modules.flatMap((module) => module.migrations.components ?? []),
			loader: Effect.all(modules.map((module) => module.migrations.loader)).pipe(Effect.map((entries) => entries.flat())),
		},
		queues,
		services: Layer.mergeAll(Layer.empty, ...modules.map((module) => module.services)).pipe(Layer.provideMerge(ports)),
		workers: Layer.mergeAll(Layer.empty, ...modules.map((module) => module.workers ?? Layer.empty)),
	};
});
