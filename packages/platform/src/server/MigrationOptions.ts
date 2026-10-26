import type { Duration } from "effect";
import type { Migrator } from "effect/sql";
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";

export interface MigrationOptions<R = never> {
	readonly components?: readonly SchemaComponent<R>[];
	readonly loader: Migrator.Loader<R>;
	readonly lockTimeout?: Duration.Input;
	readonly mode?: "migrate" | "check" | "wait";
	readonly pollInterval?: Duration.Input;
	readonly progressInterval?: Duration.Input;
	readonly release?: string;
	readonly table?: string;
	readonly waitTimeout?: Duration.Input;
}
