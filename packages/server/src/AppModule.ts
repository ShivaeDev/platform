import type { Layer, Pipeable } from "effect";
import type { RpcGroup } from "effect/rpc";
import type { AnyAdminRegistry } from "@shivaedev/admin/registry.ts";
import type { AnyModule } from "@shivaedev/contract/moduleHandlers.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";

export type ModuleLayer = Layer.Any & Pipeable.Pipeable;
export type ModuleAdmin = AnyAdminRegistry & { readonly group: RpcGroup.Any; readonly handlers: ModuleLayer };

interface ModuleParts {
	readonly admin?: ModuleAdmin;
	readonly migrations?: Pick<MigrationOptions<unknown, unknown>, "loader" | "components">;
	readonly ports?: ModuleLayer;
	readonly queues?: readonly { readonly name: string }[];
	readonly requestServices?: Layer.Layer<never, never, unknown>;
	readonly services?: ModuleLayer;
	readonly workers?: ModuleLayer;
}

// "~requires" exists only on a defined module, so the group form refuses one and it registers as `module:` instead.
// A defined module already carries its name, so its registration takes none that could disagree with it.
// A registration that serves no RPCs, such as one with only admin pages, queues or workers, names neither a group nor a module.
export type AppModule =
	| (ModuleParts & {
			readonly group: RpcGroup.Any & { readonly "~requires"?: never };
			readonly handlers: ModuleLayer;
			readonly module?: never;
			readonly name: string;
	  })
	| (ModuleParts & { readonly group?: never; readonly handlers?: never; readonly module: RegisteredModule; readonly name?: never })
	| (ModuleParts & { readonly group?: never; readonly handlers?: never; readonly module?: never; readonly name?: string });

// A module's services exist only in its type, and appModules reads them from the registration's own type.
export type RegisteredModule = RpcGroup.Any & Pick<AnyModule, "application" | "declaration"> & { readonly "~requires": unknown };
