import type { Layer, Pipeable } from "effect";
import type { RpcGroup } from "effect/rpc";
import type { AnyAdminRegistry } from "@shivaedev/admin/registry.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";

export type ModuleLayer = Layer.Any & Pipeable.Pipeable;
export type ModuleAdmin = AnyAdminRegistry & { readonly handlers: ModuleLayer };

export interface AppModule {
	readonly admin?: ModuleAdmin;
	readonly group: RpcGroup.Any;
	readonly handlers: ModuleLayer;
	readonly migrations: Pick<MigrationOptions<unknown, unknown>, "loader" | "components">;
	readonly name: string;
	readonly ports?: ModuleLayer;
	readonly queues?: readonly { readonly name: string }[];
	readonly requestServices?: Layer.Layer<never, never, unknown>;
	readonly services: ModuleLayer;
	readonly workers?: ModuleLayer;
}
