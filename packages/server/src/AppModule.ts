import type { Layer, Pipeable } from "effect";
import type { RpcGroup } from "effect/rpc";
import type { AnyAdminRegistry } from "@shivaedev/admin/registry.ts";
import type { AnyModule } from "@shivaedev/contract/moduleHandlers.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";

export type ModuleLayer = Layer.Any & Pipeable.Pipeable;
export type ModuleAdmin = AnyAdminRegistry & { readonly handlers: ModuleLayer };

interface ModuleParts {
	readonly admin?: ModuleAdmin;
	readonly migrations: Pick<MigrationOptions<unknown, unknown>, "loader" | "components">;
	readonly name: string;
	readonly ports?: ModuleLayer;
	readonly queues?: readonly { readonly name: string }[];
	readonly requestServices?: Layer.Layer<never, never, unknown>;
	readonly services: ModuleLayer;
	readonly workers?: ModuleLayer;
}

// "~requires" exists only on a defined module, so this branch refuses one and it registers as `module:` instead.
export type AppModule =
	| (ModuleParts & {
			readonly group: RpcGroup.Any & { readonly "~requires"?: never };
			readonly handlers: ModuleLayer;
			readonly module?: never;
	  })
	| (ModuleParts & { readonly group?: never; readonly handlers?: never; readonly module: RegisteredModule });

// A module's requires list exists only in its type, and appModules reads it from the registration's own type.
export type RegisteredModule = RpcGroup.Any & Pick<AnyModule, "application" | "declaration"> & { readonly "~requires": unknown };
